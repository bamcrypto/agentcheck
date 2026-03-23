import { createLogger } from '../utils/logger.js';
import { cache, TTL } from '../data/cache.js';
import { getDb, getAgentList, getRecentSnapshots } from '../data/database.js';
import { computeAgentMetrics, getDailyRevenue, getDailyJobs } from '../data/agent-data.js';
import { getTokenPrice, getMarketCap } from '../data/token-data.js';
import { computeAllMetrics, RawAgentData } from '../scoring/metrics.js';
import { computeThesisScore } from '../scoring/thesis-score.js';
import { scoreToRating } from '../scoring/rating.js';
import { findComparableAgents, getMarketOverview } from '../scoring/comparables.js';
import { formatAgentThesis, formatUndervaluedScan, formatComparison } from './formatter.js';

const log = createLogger('acp-server');

/**
 * Handle an `agent_thesis` query.
 */
export async function handleAgentThesis(query: string): Promise<Record<string, unknown>> {
  const cacheKey = `thesis:${query.toLowerCase()}`;
  const cached = cache.get<Record<string, unknown>>(cacheKey);
  if (cached) return cached;

  // Resolve the query to an agent
  const agent = await resolveAgent(query);
  if (!agent) {
    return { error: 'Agent not found', query };
  }

  // Get on-chain metrics
  const agentMetrics = await computeAgentMetrics(agent.agent_address);

  // Get previous period revenue for growth calculation
  const prevPeriodRevenue = await getPreviousPeriodRevenue(agent.agent_address);

  // Get token data
  const priceData = await getTokenPrice(agent.token_address);
  const marketCap = await getMarketCap(agent.token_address);

  // Get trend data
  const dailyRevenue = await getDailyRevenue(agent.agent_address, 7);
  const dailyJobs = await getDailyJobs(agent.agent_address, 7);

  // Compute week-over-week job velocity
  const currentWeekJobs = dailyJobs.reduce((a, b) => a + b, 0);
  const prevWeekJobs = await getWeekJobCount(agent.agent_address, 1);

  // Assemble raw data
  const rawData: RawAgentData = {
    totalJobs: agentMetrics.totalJobs,
    completedJobs: agentMetrics.completedJobs,
    failedJobs: agentMetrics.failedJobs,
    expiredJobs: agentMetrics.expiredJobs,
    totalRevenueUsd: agentMetrics.totalRevenueUsd,
    periodRevenueUsd: agentMetrics.periodRevenueUsd,
    previousPeriodRevenueUsd: prevPeriodRevenue,
    periodJobs: agentMetrics.periodJobs,
    uniqueBuyers: agentMetrics.uniqueBuyers,
    top3BuyerRevenuePct: agentMetrics.top3BuyerRevenuePct,
    offeringsCount: 0,
    dailyRevenue7d: dailyRevenue,
    dailyJobs7d: dailyJobs,
    previousWeekJobs: prevWeekJobs,
    currentWeekJobs,
    priceUsd: priceData?.priceUsd ?? 0,
    marketCap,
    holderCount: 0,
    volume24h: 0,
    liquidityUsd: 0,
  };

  // Compute metrics and score
  const metrics = computeAllMetrics(rawData);
  const thesisScore = computeThesisScore(metrics);
  const rating = scoreToRating(thesisScore);

  // Get comparables and score history
  const comparables = await findComparableAgents(agent.agent_address, metrics.monthlyRevenue);
  const snapshots = await getRecentSnapshots(agent.agent_address, 5);
  const scoreHistory = snapshots.map((s) => (s.thesis_score as number) || 0).reverse();

  const result = formatAgentThesis({
    agent: agent.name,
    token: agent.ticker,
    tokenAddress: agent.token_address,
    mcap: marketCap,
    priceUsd: priceData?.priceUsd ?? 0,
    thesisScore,
    rating,
    metrics,
    totalJobs: agentMetrics.totalJobs,
    uniqueBuyers30d: agentMetrics.uniqueBuyers,
    dailyRevenue7d: dailyRevenue,
    dailyJobs7d: dailyJobs,
    scoreHistory,
    comparables,
  });

  cache.set(cacheKey, result, TTL.AGENT_ANALYSIS);
  return result;
}

/**
 * Handle an `undervalued_scan` query.
 */
export async function handleUndervaluedScan(filters?: {
  minRevenue?: number;
  minJobs?: number;
  category?: string;
  limit?: number;
}): Promise<Record<string, unknown>> {
  const cacheKey = `scan:${JSON.stringify(filters ?? {})}`;
  const cached = cache.get<Record<string, unknown>>(cacheKey);
  if (cached) return cached;

  const limit = filters?.limit ?? 10;
  const agents = await getAgentList();

  // Score all agents
  const scored: Array<{
    agent: string;
    token: string;
    thesisScore: number;
    rating: string;
    mcap: number;
    monthlyRevenue: number;
    revenueToMcap: number;
    revenueGrowth30d: number;
  }> = [];

  for (const agent of agents) {
    if (!agent.token_address) continue;

    try {
      const agentMetrics = await computeAgentMetrics(agent.agent_address);
      const prevRevenue = await getPreviousPeriodRevenue(agent.agent_address);
      const marketCap = await getMarketCap(agent.token_address);
      const dailyJobs = await getDailyJobs(agent.agent_address, 7);
      const currentWeekJobs = dailyJobs.reduce((a, b) => a + b, 0);
      const prevWeekJobs = await getWeekJobCount(agent.agent_address, 1);

      // Apply filters
      if (filters?.minRevenue && agentMetrics.periodRevenueUsd < filters.minRevenue) continue;
      if (filters?.minJobs && agentMetrics.totalJobs < filters.minJobs) continue;

      const rawData: RawAgentData = {
        totalJobs: agentMetrics.totalJobs,
        completedJobs: agentMetrics.completedJobs,
        failedJobs: agentMetrics.failedJobs,
        expiredJobs: agentMetrics.expiredJobs,
        totalRevenueUsd: agentMetrics.totalRevenueUsd,
        periodRevenueUsd: agentMetrics.periodRevenueUsd,
        previousPeriodRevenueUsd: prevRevenue,
        periodJobs: agentMetrics.periodJobs,
        uniqueBuyers: agentMetrics.uniqueBuyers,
        top3BuyerRevenuePct: agentMetrics.top3BuyerRevenuePct,
        offeringsCount: 0,
        dailyRevenue7d: [],
        dailyJobs7d: dailyJobs,
        previousWeekJobs: prevWeekJobs,
        currentWeekJobs,
        priceUsd: 0,
        marketCap,
        holderCount: 0,
        volume24h: 0,
        liquidityUsd: 0,
      };

      const metrics = computeAllMetrics(rawData);
      const thesisScore = computeThesisScore(metrics);
      const rating = scoreToRating(thesisScore);

      scored.push({
        agent: agent.name,
        token: agent.ticker,
        thesisScore,
        rating: rating.rating,
        mcap: marketCap,
        monthlyRevenue: metrics.monthlyRevenue,
        revenueToMcap: metrics.revenueToMcap,
        revenueGrowth30d: metrics.revenueGrowth30d,
      });
    } catch (e) {
      log.error(`Failed to score agent ${agent.name}`, e);
    }
  }

  // Sort and split
  scored.sort((a, b) => b.thesisScore - a.thesisScore);

  const undervalued = scored.slice(0, limit).map((a) => ({
    ...a,
    keySignal: generateKeySignal(a),
  }));

  const overvalued = scored.slice(-Math.min(5, scored.length)).reverse().map((a) => ({
    ...a,
    keySignal: generateKeySignal(a),
  }));

  const overview = await getMarketOverview();

  const result = formatUndervaluedScan({
    totalAnalysed: agents.length,
    withRevenue: scored.filter((s) => s.monthlyRevenue > 0).length,
    undervalued,
    overvalued,
    marketOverview: overview,
  });

  cache.set(cacheKey, result, TTL.SCAN_RESULTS);
  return result;
}

/**
 * Handle a `compare_agents` query.
 */
export async function handleCompareAgents(queries: string[]): Promise<Record<string, unknown>> {
  const results: Array<{
    agent: string;
    token: string;
    thesisScore: number;
    rating: string;
    mcap: number;
    metrics: ReturnType<typeof computeAllMetrics>;
  }> = [];

  for (const query of queries) {
    const agent = await resolveAgent(query);
    if (!agent) {
      results.push({
        agent: query,
        token: query,
        thesisScore: 0,
        rating: 'unknown',
        mcap: 0,
        metrics: {
          revenueToMcap: 0,
          revenueGrowth30d: 0,
          revenuePersistence: 0,
          jobVelocityTrend: 1,
          successRate: 0,
          buyerConcentration: 0,
          buyerScale: 0,
          jobScale: 0,
          priceToRevenue: 0,
          monthlyRevenue: 0,
        },
      });
      continue;
    }

    const agentMetrics = await computeAgentMetrics(agent.agent_address);
    const prevRevenue = await getPreviousPeriodRevenue(agent.agent_address);
    const marketCap = await getMarketCap(agent.token_address);
    const dailyJobs = await getDailyJobs(agent.agent_address, 7);
    const currentWeekJobs = dailyJobs.reduce((a, b) => a + b, 0);
    const prevWeekJobs = await getWeekJobCount(agent.agent_address, 1);

    const rawData: RawAgentData = {
      totalJobs: agentMetrics.totalJobs,
      completedJobs: agentMetrics.completedJobs,
      failedJobs: agentMetrics.failedJobs,
      expiredJobs: agentMetrics.expiredJobs,
      totalRevenueUsd: agentMetrics.totalRevenueUsd,
      periodRevenueUsd: agentMetrics.periodRevenueUsd,
      previousPeriodRevenueUsd: prevRevenue,
      periodJobs: agentMetrics.periodJobs,
      uniqueBuyers: agentMetrics.uniqueBuyers,
      top3BuyerRevenuePct: agentMetrics.top3BuyerRevenuePct,
      offeringsCount: 0,
      dailyRevenue7d: [],
      dailyJobs7d: dailyJobs,
      previousWeekJobs: prevWeekJobs,
      currentWeekJobs,
      priceUsd: 0,
      marketCap,
      holderCount: 0,
      volume24h: 0,
      liquidityUsd: 0,
    };

    const metrics = computeAllMetrics(rawData);
    const thesisScore = computeThesisScore(metrics);
    const rating = scoreToRating(thesisScore);

    results.push({
      agent: agent.name,
      token: agent.ticker,
      thesisScore,
      rating: rating.rating,
      mcap: marketCap,
      metrics,
    });
  }

  return formatComparison(results);
}

// --- Helper functions ---

async function resolveAgent(query: string): Promise<{
  agent_address: string;
  name: string;
  ticker: string;
  token_address: string;
} | null> {
  const database = await getDb();
  const normalized = query.replace(/^\$/, '').toLowerCase();

  // Search by ticker or name
  const result = database.exec(
    `SELECT agent_address, name, ticker, token_address FROM agents
     WHERE LOWER(ticker) = ? OR LOWER(REPLACE(ticker, '$', '')) = ?
     OR LOWER(name) LIKE ?
     LIMIT 1`,
    [normalized, normalized, `%${normalized}%`],
  );

  if (!result.length || !result[0].values.length) return null;

  const row = result[0].values[0];
  return {
    agent_address: row[0] as string,
    name: row[1] as string,
    ticker: row[2] as string,
    token_address: row[3] as string,
  };
}

async function getPreviousPeriodRevenue(agentAddress: string): Promise<number> {
  const database = await getDb();
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const result = database.exec(
    `SELECT COALESCE(SUM(amount_usd), 0) FROM job_events
     WHERE agent_address = ? AND event_type = 'completed'
     AND timestamp >= ? AND timestamp < ?`,
    [agentAddress, sixtyDaysAgo, thirtyDaysAgo],
  );

  return (result[0]?.values[0]?.[0] as number) || 0;
}

async function getWeekJobCount(agentAddress: string, weeksAgo: number): Promise<number> {
  const database = await getDb();
  const end = new Date(Date.now() - weeksAgo * 7 * 24 * 60 * 60 * 1000).toISOString();
  const start = new Date(Date.now() - (weeksAgo + 1) * 7 * 24 * 60 * 60 * 1000).toISOString();

  const result = database.exec(
    `SELECT COUNT(*) FROM job_events
     WHERE agent_address = ? AND event_type = 'completed'
     AND timestamp >= ? AND timestamp < ?`,
    [agentAddress, start, end],
  );

  return (result[0]?.values[0]?.[0] as number) || 0;
}

function generateKeySignal(agent: {
  revenueGrowth30d: number;
  revenueToMcap: number;
  mcap: number;
  monthlyRevenue: number;
  thesisScore: number;
}): string {
  if (agent.thesisScore >= 80 && agent.revenueGrowth30d > 0.2) {
    return `Revenue growing ${(agent.revenueGrowth30d * 100).toFixed(0)}% MoM with strong fundamentals — significant undervaluation`;
  }
  if (agent.thesisScore >= 60 && agent.revenueToMcap > 0.3) {
    return `High revenue yield (${(agent.revenueToMcap * 100).toFixed(0)}% annualized) relative to market cap`;
  }
  if (agent.thesisScore <= 20 && agent.monthlyRevenue < 500) {
    return `$${(agent.mcap / 1000000).toFixed(1)}M mcap with only $${Math.round(agent.monthlyRevenue)}/month revenue — extreme overvaluation`;
  }
  if (agent.revenueGrowth30d < -0.2) {
    return `Revenue declining ${(Math.abs(agent.revenueGrowth30d) * 100).toFixed(0)}% MoM — deteriorating fundamentals`;
  }
  return `Thesis score ${agent.thesisScore} — ${agent.thesisScore >= 50 ? 'positive' : 'negative'} fundamental outlook`;
}

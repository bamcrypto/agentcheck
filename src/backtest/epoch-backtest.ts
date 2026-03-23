import axios from 'axios';
import { VIRTUALS_API } from '../config/api-endpoints.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('epoch-backtest');

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface EpochAgent {
  acpAgentId: number;
  agentName: string;
  tokenAddress: string;
  totalRevenue: number;
  successRate: number;
  successfulJobCount: number;
  uniqueBuyerCount: number;
  rank: number;
  agentScore: number;
  mcapInVirtual: number;
  holderCount: number;
  symbol: string;
}

interface ScoredAgent {
  agent: EpochAgent;
  score: number;
  components: Record<string, number>;
  revenueGrowth: number;
  rankChange: number;
}

interface ScoringWeightsV2 {
  revenueYield: number;
  revenueGrowth: number;     // NEW: momentum — epoch-over-epoch revenue change
  revenuePersistence: number; // NEW: how many epochs the agent earned revenue
  successRate: number;
  buyerScale: number;         // renamed from buyerDiversity
  jobScale: number;
}

const DEFAULT_WEIGHTS: ScoringWeightsV2 = {
  revenueYield: 0.20,
  revenueGrowth: 0.25,
  revenuePersistence: 0.15,
  successRate: 0.15,
  buyerScale: 0.15,
  jobScale: 0.10,
};

// Minimum filters
const MIN_EPOCH_REVENUE = 10;   // $10 minimum per epoch to be scored
const MIN_MCAP = 100;           // minimum mcap in VIRTUAL to be scored

/**
 * Fetch full leaderboard for a given epoch.
 */
async function fetchEpochData(epochId: number): Promise<EpochAgent[]> {
  try {
    const url = `${VIRTUALS_API.baseUrl}${VIRTUALS_API.endpoints.epochRanking.replace(':epochId', String(epochId))}`;
    const resp = await axios.get(url, {
      params: { 'pagination[pageSize]': 1000 },
      timeout: 30000,
    });

    const data = resp.data?.data ?? [];
    return data.map((item: Record<string, unknown>) => {
      const v = (item.virtual ?? {}) as Record<string, unknown>;
      return {
        acpAgentId: item.acpAgentId ?? item.agentId,
        agentName: item.agentName,
        tokenAddress: (item.tokenAddress as string) ?? (v.tokenAddress as string) ?? '',
        totalRevenue: (item.totalRevenue as number) ?? 0,
        successRate: (item.successRate as number) ?? 0,
        successfulJobCount: (item.successfulJobCount as number) ?? 0,
        uniqueBuyerCount: (item.uniqueBuyerCount as number) ?? 0,
        rank: (item.rank as number) ?? 0,
        agentScore: (item.agentScore as number) ?? 0,
        mcapInVirtual: (v.mcapInVirtual as number) ?? 0,
        holderCount: (v.holderCount as number) ?? 0,
        symbol: (v.symbol as string) ?? (item.symbol as string) ?? '',
      };
    });
  } catch (e) {
    log.error(`Failed to fetch epoch ${epochId}`, e);
    return [];
  }
}

/**
 * Spearman rank correlation.
 */
function spearmanCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 3) return 0;
  const n = x.length;

  const rankArray = (arr: number[]): number[] => {
    const indexed = arr.map((v, i) => ({ v, i }));
    indexed.sort((a, b) => a.v - b.v);
    const ranks = new Array(n);
    for (let i = 0; i < n; i++) {
      ranks[indexed[i].i] = i + 1;
    }
    return ranks;
  };

  const xRanks = rankArray(x);
  const yRanks = rankArray(y);

  let dSquaredSum = 0;
  for (let i = 0; i < n; i++) {
    const d = xRanks[i] - yRanks[i];
    dSquaredSum += d * d;
  }

  return 1 - (6 * dSquaredSum) / (n * (n * n - 1));
}

/**
 * Normalize value to 0-100 using min-max with clipping.
 */
function norm(value: number, min: number, max: number): number {
  if (max <= min) return 50;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

/**
 * Compute the improved thesis score for an agent using multi-epoch context.
 *
 * @param agent - Current epoch data
 * @param prevEpochRevenue - Revenue in the previous epoch (for momentum)
 * @param epochsWithRevenue - How many of the past epochs this agent had revenue (persistence)
 * @param totalEpochsSeen - Total epochs we have data for this agent
 * @param weights - Scoring weights
 */
function computeScoreV2(
  agent: EpochAgent,
  prevEpochRevenue: number,
  epochsWithRevenue: number,
  totalEpochsSeen: number,
  weights: ScoringWeightsV2 = DEFAULT_WEIGHTS,
): { score: number; components: Record<string, number> } {

  // 1. Revenue Yield: epoch revenue / current mcap
  const revenueYield = agent.mcapInVirtual > 0
    ? agent.totalRevenue / agent.mcapInVirtual
    : 0;
  const yieldNorm = norm(revenueYield, 0, 0.5);

  // 2. Revenue Growth (MOMENTUM): % change from previous epoch
  let growthNorm: number;
  if (prevEpochRevenue > MIN_EPOCH_REVENUE) {
    const growth = (agent.totalRevenue - prevEpochRevenue) / prevEpochRevenue;
    // Clip growth to [-1, +5] range before normalizing
    growthNorm = norm(Math.max(-1, Math.min(5, growth)), -1, 3);
  } else if (agent.totalRevenue > MIN_EPOCH_REVENUE) {
    // New agent with first meaningful revenue — moderate positive signal
    growthNorm = 60;
  } else {
    growthNorm = 30; // no data
  }

  // 3. Revenue Persistence: fraction of epochs with meaningful revenue
  const persistenceRatio = totalEpochsSeen > 0 ? epochsWithRevenue / totalEpochsSeen : 0;
  const persistenceNorm = norm(persistenceRatio, 0, 1);

  // 4. Success Rate: normalized in 70-100% range
  const srNorm = norm(agent.successRate, 70, 100);

  // 5. Buyer Scale: log-scaled unique buyers
  const buyerNorm = norm(Math.log10(Math.max(1, agent.uniqueBuyerCount)), 0, 4);

  // 6. Job Scale: log-scaled job count
  const jobNorm = norm(Math.log10(Math.max(1, agent.successfulJobCount)), 0, 6);

  const score =
    weights.revenueYield * yieldNorm +
    weights.revenueGrowth * growthNorm +
    weights.revenuePersistence * persistenceNorm +
    weights.successRate * srNorm +
    weights.buyerScale * buyerNorm +
    weights.jobScale * jobNorm;

  return {
    score: Math.round(Math.max(0, Math.min(100, score))),
    components: {
      revenueYield: Math.round(yieldNorm),
      revenueGrowth: Math.round(growthNorm),
      persistence: Math.round(persistenceNorm),
      successRate: Math.round(srNorm),
      buyerScale: Math.round(buyerNorm),
      jobScale: Math.round(jobNorm),
    },
  };
}

/**
 * Run the improved epoch-based backtest.
 *
 * Tests multiple weight configurations to find the best one.
 */
export async function runEpochBacktest(): Promise<void> {
  const epochs = [1, 2, 3, 4, 5];

  console.log('\n========================================');
  console.log('   THESIS EPOCH BACKTEST v2');
  console.log('========================================\n');
  console.log(`Testing across ${epochs.length} weekly epochs`);
  console.log(`Filters: min $${MIN_EPOCH_REVENUE} epoch revenue, min ${MIN_MCAP} VIRTUAL mcap\n`);

  // Fetch all epoch data
  const epochData = new Map<number, EpochAgent[]>();
  for (const epoch of epochs) {
    log.info(`Fetching epoch ${epoch} data...`);
    const data = await fetchEpochData(epoch);
    epochData.set(epoch, data);
    console.log(`  Epoch ${epoch}: ${data.length} agents loaded`);
    await delay(500);
  }
  console.log('');

  // Build agent revenue history across all epochs
  // Key: agentName → Map<epochId, revenue>
  const revenueHistory = new Map<string, Map<number, number>>();
  for (const [epochId, agents] of epochData) {
    for (const agent of agents) {
      if (!revenueHistory.has(agent.agentName)) {
        revenueHistory.set(agent.agentName, new Map());
      }
      revenueHistory.get(agent.agentName)!.set(epochId, agent.totalRevenue);
    }
  }

  // Test multiple weight configurations
  const weightConfigs: Array<{ name: string; weights: ScoringWeightsV2 }> = [
    { name: 'Default (balanced)', weights: DEFAULT_WEIGHTS },
    {
      name: 'Momentum + Scale',
      weights: { revenueYield: 0.10, revenueGrowth: 0.30, revenuePersistence: 0.10, successRate: 0.10, buyerScale: 0.20, jobScale: 0.20 },
    },
    {
      name: 'Scale + Persistence',
      weights: { revenueYield: 0.10, revenueGrowth: 0.15, revenuePersistence: 0.25, successRate: 0.10, buyerScale: 0.20, jobScale: 0.20 },
    },
    {
      name: 'Anti-yield (contrarian)',
      weights: { revenueYield: -0.20, revenueGrowth: 0.30, revenuePersistence: 0.20, successRate: 0.15, buyerScale: 0.25, jobScale: 0.30 },
    },
    {
      name: 'Pure scale',
      weights: { revenueYield: 0.00, revenueGrowth: 0.10, revenuePersistence: 0.10, successRate: 0.10, buyerScale: 0.35, jobScale: 0.35 },
    },
    {
      name: 'Buyer-led growth',
      weights: { revenueYield: 0.05, revenueGrowth: 0.25, revenuePersistence: 0.15, successRate: 0.10, buyerScale: 0.35, jobScale: 0.10 },
    },
    {
      name: 'Jobs-led growth',
      weights: { revenueYield: 0.05, revenueGrowth: 0.25, revenuePersistence: 0.15, successRate: 0.15, buyerScale: 0.10, jobScale: 0.30 },
    },
  ];

  const configResults: Array<{
    name: string;
    overallRevCorr: number;
    overallRankCorr: number;
    avgSpread: number;
    pairDetails: Array<{
      fromEpoch: number;
      toEpoch: number;
      dataPoints: number;
      revCorr: number;
      rankCorr: number;
      topQRevGrowth: number;
      bottomQRevGrowth: number;
      spread: number;
    }>;
  }> = [];

  for (const config of weightConfigs) {
    const allScores: number[] = [];
    const allRevGrowths: number[] = [];
    const allRankChanges: number[] = [];
    const pairDetails: typeof configResults[0]['pairDetails'] = [];

    for (let i = 0; i < epochs.length - 1; i++) {
      const currentEpoch = epochs[i];
      const nextEpoch = epochs[i + 1];

      const currentData = epochData.get(currentEpoch) ?? [];
      const nextData = epochData.get(nextEpoch) ?? [];

      // Build lookup for next epoch
      const nextByName = new Map<string, EpochAgent>();
      for (const agent of nextData) {
        nextByName.set(agent.agentName, agent);
      }

      const scored: ScoredAgent[] = [];

      for (const agent of currentData) {
        // Apply filters
        if (agent.totalRevenue < MIN_EPOCH_REVENUE) continue;
        if (agent.mcapInVirtual < MIN_MCAP) continue;

        const nextAgent = nextByName.get(agent.agentName);
        if (!nextAgent) continue;
        if (nextAgent.totalRevenue < 1) continue; // must exist in next epoch with some revenue

        // Get previous epoch revenue for momentum
        const prevEpochId = i > 0 ? epochs[i - 1] : undefined;
        const prevRevenue = prevEpochId !== undefined
          ? (revenueHistory.get(agent.agentName)?.get(prevEpochId) ?? 0)
          : 0;

        // Count epochs with meaningful revenue (persistence)
        const agentHistory = revenueHistory.get(agent.agentName);
        const epochsSeen = agentHistory ? Math.min(agentHistory.size, currentEpoch) : 1;
        const epochsWithRev = agentHistory
          ? [...agentHistory.entries()].filter(([eid, rev]) => eid <= currentEpoch && rev >= MIN_EPOCH_REVENUE).length
          : 0;

        const { score, components } = computeScoreV2(
          agent, prevRevenue, epochsWithRev, epochsSeen, config.weights,
        );

        // Forward metrics — use log ratio to tame outliers from tiny bases
        const revenueGrowth = Math.log((nextAgent.totalRevenue + 10) / (agent.totalRevenue + 10));
        const rankChange = agent.rank - nextAgent.rank; // positive = improved

        scored.push({ agent, score, components, revenueGrowth, rankChange });
      }

      if (scored.length < 10) continue;

      const scores = scored.map((s) => s.score);
      const revGrowths = scored.map((s) => s.revenueGrowth);
      const rankChanges = scored.map((s) => s.rankChange);

      const revCorr = spearmanCorrelation(scores, revGrowths);
      const rankCorr = spearmanCorrelation(scores, rankChanges);

      allScores.push(...scores);
      allRevGrowths.push(...revGrowths);
      allRankChanges.push(...rankChanges);

      // Quintile analysis
      const sorted = [...scored].sort((a, b) => b.score - a.score);
      const qSize = Math.max(1, Math.floor(sorted.length / 5));
      const topQ = sorted.slice(0, qSize);
      const bottomQ = sorted.slice(-qSize);
      const avgRev = (arr: ScoredAgent[]) => arr.reduce((s, m) => s + m.revenueGrowth, 0) / arr.length;

      pairDetails.push({
        fromEpoch: currentEpoch,
        toEpoch: nextEpoch,
        dataPoints: scored.length,
        revCorr,
        rankCorr,
        topQRevGrowth: avgRev(topQ),
        bottomQRevGrowth: avgRev(bottomQ),
        spread: avgRev(topQ) - avgRev(bottomQ),
      });
    }

    const overallRevCorr = spearmanCorrelation(allScores, allRevGrowths);
    const overallRankCorr = spearmanCorrelation(allScores, allRankChanges);
    const avgSpread = pairDetails.length > 0
      ? pairDetails.reduce((s, r) => s + r.spread, 0) / pairDetails.length
      : 0;

    configResults.push({
      name: config.name,
      overallRevCorr,
      overallRankCorr,
      avgSpread,
      pairDetails,
    });
  }

  // ===== RESULTS =====
  console.log('========================================');
  console.log('  WEIGHT CONFIGURATION COMPARISON');
  console.log('========================================\n');

  console.log('Config                  | Rev Corr | Rank Corr | Avg Spread | Data Pts');
  console.log('─'.repeat(78));

  let bestConfig = configResults[0];
  for (const r of configResults) {
    const name = r.name.padEnd(23);
    const revCorr = fmtCorr(r.overallRevCorr).padStart(8);
    const rankCorr = fmtCorr(r.overallRankCorr).padStart(9);
    const spread = `${(r.avgSpread * 100).toFixed(1)}%`.padStart(10);
    const dp = String(r.pairDetails.reduce((s, p) => s + p.dataPoints, 0)).padStart(8);
    console.log(`${name} | ${revCorr} | ${rankCorr} | ${spread} | ${dp}`);

    // Best = highest revenue correlation
    if (r.overallRevCorr > bestConfig.overallRevCorr) {
      bestConfig = r;
    }
  }

  console.log('─'.repeat(78));
  console.log(`\nBest config: "${bestConfig.name}" (rev correlation: ${fmtCorr(bestConfig.overallRevCorr)})\n`);

  // Detailed results for best config
  console.log('========================================');
  console.log(`  DETAILED: ${bestConfig.name.toUpperCase()}`);
  console.log('========================================\n');

  for (const pair of bestConfig.pairDetails) {
    console.log(`  Epoch ${pair.fromEpoch}→${pair.toEpoch}: ${pair.dataPoints} agents`);
    console.log(`    Rev correlation:  ${fmtCorr(pair.revCorr)}`);
    console.log(`    Rank correlation: ${fmtCorr(pair.rankCorr)}`);
    console.log(`    Top 20% rev growth:    ${(pair.topQRevGrowth * 100).toFixed(1)}%`);
    console.log(`    Bottom 20% rev growth: ${(pair.bottomQRevGrowth * 100).toFixed(1)}%`);
    console.log(`    Spread:                ${(pair.spread * 100).toFixed(1)}%\n`);
  }

  // Now show the actual top picks using best config on latest epoch
  console.log('========================================');
  console.log('  CURRENT TOP PICKS (Epoch 5)');
  console.log('========================================\n');

  const latestData = epochData.get(5) ?? [];
  const latestScored: Array<{ agent: EpochAgent; score: number; components: Record<string, number> }> = [];

  for (const agent of latestData) {
    if (agent.totalRevenue < MIN_EPOCH_REVENUE) continue;
    if (agent.mcapInVirtual < MIN_MCAP) continue;

    const agentHistory = revenueHistory.get(agent.agentName);
    const prevRevenue = agentHistory?.get(4) ?? 0;
    const epochsSeen = agentHistory ? Math.min(agentHistory.size, 5) : 1;
    const epochsWithRev = agentHistory
      ? [...agentHistory.entries()].filter(([, rev]) => rev >= MIN_EPOCH_REVENUE).length
      : 0;

    const bestWeights = weightConfigs.find((c) => c.name === bestConfig.name)!.weights;
    const { score, components } = computeScoreV2(agent, prevRevenue, epochsWithRev, epochsSeen, bestWeights);
    latestScored.push({ agent, score, components });
  }

  latestScored.sort((a, b) => b.score - a.score);

  console.log('Rank | Score | Agent                    | Epoch Rev  | MCap(V)    | SR     | Buyers | Persistence | Growth');
  console.log('─'.repeat(115));

  for (let i = 0; i < Math.min(25, latestScored.length); i++) {
    const s = latestScored[i];
    const rank = String(i + 1).padStart(4);
    const score = String(s.score).padStart(5);
    const name = s.agent.agentName.substring(0, 24).padEnd(24);
    const rev = `$${s.agent.totalRevenue.toFixed(0)}`.padStart(10);
    const mcap = `${(s.agent.mcapInVirtual / 1000).toFixed(0)}K`.padStart(10);
    const sr = `${s.agent.successRate.toFixed(1)}%`.padStart(6);
    const buyers = String(s.agent.uniqueBuyerCount).padStart(6);
    const persist = `${s.components.persistence}`.padStart(11);
    const growth = `${s.components.revenueGrowth}`.padStart(6);
    console.log(`${rank} | ${score} | ${name} | ${rev} | ${mcap} | ${sr} | ${buyers} | ${persist} | ${growth}`);
  }

  console.log('─'.repeat(115));

  // Interpretation
  console.log('\nInterpretation:');
  if (bestConfig.overallRevCorr > 0.15) {
    console.log('  STRONG signal: Thesis scores meaningfully predict future revenue growth.');
  } else if (bestConfig.overallRevCorr > 0.05) {
    console.log('  MODERATE signal: Some predictive power for revenue growth.');
  } else if (bestConfig.overallRevCorr > -0.05) {
    console.log('  NEUTRAL: Score captures fundamentals but not forward momentum well.');
  } else {
    console.log('  INVERSE: Model needs further recalibration.');
  }

  if (bestConfig.avgSpread > 0.05) {
    console.log(`  POSITIVE spread (${(bestConfig.avgSpread * 100).toFixed(1)}%): High-scored agents grow revenue faster than low-scored.`);
  } else if (bestConfig.avgSpread > 0) {
    console.log(`  NARROW spread (${(bestConfig.avgSpread * 100).toFixed(1)}%): Directionally correct but not strongly differentiating.`);
  } else {
    console.log(`  NEGATIVE spread: Further weight tuning needed.`);
  }

  console.log('\n========================================\n');
}

function fmtCorr(corr: number): string {
  return `${corr >= 0 ? '+' : ''}${corr.toFixed(3)}`;
}

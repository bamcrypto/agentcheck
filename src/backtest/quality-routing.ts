/**
 * Backtest: Quality-based routing vs random/keyword routing.
 *
 * For each service category, compare:
 * 1. Random routing (current Butler behavior - pick any matching agent)
 * 2. Best-price routing (cheapest agent)
 * 3. Quality routing (highest success rate - what Thesis offers)
 *
 * Measures: expected failure rate, expected cost per successful job,
 * money wasted on failed jobs.
 */
import axios from 'axios';
import { createLogger } from '../utils/logger.js';

const log = createLogger('backtest');
const ACPX_BASE = 'https://acpx.virtuals.io/api';
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface AgentWithOfferings {
  id: number;
  name: string;
  successRate: number;
  successfulJobCount: number;
  totalJobCount: number;
  failedJobCount: number;
  revenue: number;
  uniqueBuyerCount: number;
  isOnline: boolean;
  offerings: {
    name: string;
    description: string;
    price: number;
  }[];
}

interface ServiceCategory {
  name: string;
  keywords: string[];
  agents: AgentWithOfferings[];
}

interface RoutingResult {
  category: string;
  agentCount: number;
  strategies: {
    random: StrategyResult;
    cheapest: StrategyResult;
    quality: StrategyResult;
  };
  qualityVsRandomSavings: number;
  qualityVsCheapestSavings: number;
}

interface StrategyResult {
  selectedAgent: string;
  selectedAgentId: number;
  successRate: number;
  price: number;
  expectedCostPer100Jobs: number;
  expectedFailedPer100Jobs: number;
  moneyWastedPer100Jobs: number;
}

// Service categories with keywords to match offerings
const SERVICE_CATEGORIES: { name: string; keywords: string[] }[] = [
  { name: 'Token Swap', keywords: ['swap', 'exchange', 'trade_token'] },
  { name: 'Market Analysis', keywords: ['analysis', 'market', 'intelligence', 'alpha'] },
  { name: 'Token Info', keywords: ['token_info', 'price', 'token_data'] },
  { name: 'Technical Analysis', keywords: ['technical_analysis', 'rsi', 'macd', 'chart'] },
  { name: 'Security Audit', keywords: ['security', 'audit', 'rug_pull', 'contract_check', 'safety'] },
  { name: 'Video Generation', keywords: ['video', 'promo', 'drama', 'music_video'] },
  { name: 'Content Creation', keywords: ['content', 'write', 'post', 'tweet', 'thread'] },
  { name: 'Research', keywords: ['research', 'report', 'deep_dive', 'investigate'] },
  { name: 'Risk Assessment', keywords: ['risk', 'scan', 'risk_score', 'risk_analysis'] },
  { name: 'DeFi / Yield', keywords: ['yield', 'defi', 'farm', 'lp', 'liquidity', 'dca'] },
];

async function fetchAllAgentsWithOfferings(): Promise<AgentWithOfferings[]> {
  const agents: AgentWithOfferings[] = [];
  let page = 1;

  while (page <= 10) {
    let retries = 3;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any[] = [];

    while (retries > 0) {
      try {
        const resp = await axios.get(`${ACPX_BASE}/agents`, {
          params: {
            'filters[$and][0][$or][0][hasGraduated]': true,
            'filters[$and][0][$or][1][tag]': 'OPENCLAW',
            'filters[$and][1][$or][0][role]': 'provider',
            'filters[$and][1][$or][1][role]': 'hybrid',
            'pagination[pageSize]': 100,
            'pagination[page]': page,
            'sort': 'successfulJobCount:desc',
          },
          timeout: 20000,
        });

        data = resp.data?.data ?? [];
        break;
      } catch (e) {
        retries--;
        if (retries > 0) {
          log.info(`Page ${page} failed, retrying in 3s... (${retries} retries left)`);
          await delay(3000);
        } else {
          log.error(`Failed to fetch page ${page} after retries`, e);
        }
      }
    }

    if (data.length === 0) break;

    {

      for (const d of data) {
        const sr = Math.min(d.successRate ?? d.metrics?.successRate ?? 0, 100);
        const successful = d.successfulJobCount ?? d.metrics?.successfulJobCount ?? 0;
        const total = sr > 0 ? Math.round(successful / (sr / 100)) : successful;

        agents.push({
          id: d.id,
          name: d.name ?? '',
          successRate: sr,
          successfulJobCount: successful,
          totalJobCount: total,
          failedJobCount: Math.max(0, total - successful),
          revenue: d.revenue ?? d.metrics?.revenue ?? 0,
          uniqueBuyerCount: d.uniqueBuyerCount ?? d.metrics?.uniqueBuyerCount ?? 0,
          isOnline: d.metrics?.isOnline ?? false,
          offerings: (d.jobs ?? []).map((j: Record<string, unknown>) => ({
            name: ((j.name as string) ?? '').toLowerCase(),
            description: ((j.description as string) ?? '').toLowerCase(),
            price: (j.price as number) ?? (j.priceV2 as Record<string, unknown>)?.value ?? 0,
          })),
        });
      }

    }

    page++;
    await delay(500);
  }

  return agents;
}

function matchAgentsToCategory(
  agents: AgentWithOfferings[],
  keywords: string[],
): AgentWithOfferings[] {
  return agents.filter((agent) => {
    if (agent.totalJobCount < 50) return false; // minimum track record
    return agent.offerings.some((offering) =>
      keywords.some(
        (kw) => offering.name.includes(kw) || offering.description.includes(kw),
      ),
    );
  });
}

function compositeScore(agent: AgentWithOfferings, keywords: string[]): number {
  const sr = Math.min(agent.successRate, 100);

  // Trust: revenue/buyer ratio, jobs/buyer ratio
  let trust = 100;
  if (agent.uniqueBuyerCount > 0) {
    const revPerBuyer = agent.revenue / agent.uniqueBuyerCount;
    if (revPerBuyer < 0.05 && agent.totalJobCount > 100) trust -= 40;
    else if (revPerBuyer < 0.50 && agent.totalJobCount > 500) trust -= 20;
    const jobsPerBuyer = agent.totalJobCount / agent.uniqueBuyerCount;
    if (jobsPerBuyer > 500) trust -= 25;
    else if (jobsPerBuyer > 100) trust -= 10;
  }
  if (agent.uniqueBuyerCount === 0 && agent.totalJobCount > 10) trust -= 50;
  trust = Math.max(0, Math.min(100, trust));

  // Confidence: log-scaled job volume
  const confidence = Math.min(1, Math.log10(Math.max(agent.totalJobCount, 1)) / 4) * 100;

  // Buyer diversity (inverse concentration)
  let diversity = 100;
  if (agent.uniqueBuyerCount > 0 && agent.totalJobCount > 0) {
    const concentration = Math.min(1, Math.log10(agent.totalJobCount / agent.uniqueBuyerCount) / 2);
    diversity = (1 - concentration) * 100;
  }

  // Value: cost per success
  const price = getBestOfferingPrice(agent, keywords);
  const cps = sr > 0 ? price / (sr / 100) : 100;
  const value = Math.max(0, 100 - cps * 10);

  return sr * 0.35 + trust * 0.25 + confidence * 0.20 + diversity * 0.10 + value * 0.10;
}

function getBestOfferingPrice(
  agent: AgentWithOfferings,
  keywords: string[],
): number {
  const matching = agent.offerings.filter((o) =>
    keywords.some((kw) => o.name.includes(kw) || o.description.includes(kw)),
  );
  if (matching.length === 0) return 0;
  const price = Math.min(...matching.map((o) => o.price));
  // Cap at $100 — anything above is data garbage
  return Math.min(price, 100);
}

function simulateStrategy(
  agents: AgentWithOfferings[],
  strategy: 'random' | 'cheapest' | 'quality',
  keywords: string[],
): StrategyResult {
  let selected: AgentWithOfferings;

  switch (strategy) {
    case 'random': {
      // Simulate random by computing weighted average across all agents
      // (each agent equally likely to be picked)
      const avgSuccessRate =
        agents.reduce((sum, a) => sum + a.successRate, 0) / agents.length;
      const avgPrice =
        agents.reduce((sum, a) => sum + getBestOfferingPrice(a, keywords), 0) /
        agents.length;
      const failedPer100 = 100 - avgSuccessRate;
      const totalCost = 100 * avgPrice;
      const wastedCost = failedPer100 * avgPrice;

      return {
        selectedAgent: `(avg of ${agents.length} agents)`,
        selectedAgentId: 0,
        successRate: Math.round(avgSuccessRate * 100) / 100,
        price: Math.round(avgPrice * 1000) / 1000,
        expectedCostPer100Jobs: Math.round(totalCost * 100) / 100,
        expectedFailedPer100Jobs: Math.round(failedPer100 * 100) / 100,
        moneyWastedPer100Jobs: Math.round(wastedCost * 100) / 100,
      };
    }

    case 'cheapest': {
      // Pick agent with lowest price for matching offering
      selected = agents.reduce((best, curr) => {
        const bestPrice = getBestOfferingPrice(best, keywords);
        const currPrice = getBestOfferingPrice(curr, keywords);
        return currPrice < bestPrice ? curr : best;
      });
      break;
    }

    case 'quality': {
      // Pick agent with highest composite score.
      // Composite = 35% success rate + 25% trust + 20% confidence + 10% buyer diversity + 10% value
      selected = agents.reduce((best, curr) => {
        const bestScore = compositeScore(best, keywords);
        const currScore = compositeScore(curr, keywords);
        return currScore > bestScore ? curr : best;
      });
      break;
    }
  }

  const price = getBestOfferingPrice(selected, keywords);
  const failedPer100 = 100 - selected.successRate;
  const totalCost = 100 * price;
  const wastedCost = failedPer100 * price;

  return {
    selectedAgent: selected.name,
    selectedAgentId: selected.id,
    successRate: Math.round(selected.successRate * 100) / 100,
    price: Math.round(price * 1000) / 1000,
    expectedCostPer100Jobs: Math.round(totalCost * 100) / 100,
    expectedFailedPer100Jobs: Math.round(failedPer100 * 100) / 100,
    moneyWastedPer100Jobs: Math.round(wastedCost * 100) / 100,
  };
}

/**
 * Simulate volume-weighted random routing based on actual historical job distribution.
 * Instead of equal probability, weights agents by their actual job volume
 * (approximating what Butler actually does).
 */
function simulateVolumeWeightedRandom(
  agents: AgentWithOfferings[],
  keywords: string[],
): StrategyResult {
  const totalVolume = agents.reduce((s, a) => s + a.totalJobCount, 0);
  if (totalVolume === 0) return simulateStrategy(agents, 'random', keywords);

  let weightedSuccessRate = 0;
  let weightedPrice = 0;

  for (const agent of agents) {
    const weight = agent.totalJobCount / totalVolume;
    weightedSuccessRate += agent.successRate * weight;
    weightedPrice += getBestOfferingPrice(agent, keywords) * weight;
  }

  const failedPer100 = 100 - weightedSuccessRate;
  const totalCost = 100 * weightedPrice;
  const wastedCost = failedPer100 * weightedPrice;

  return {
    selectedAgent: `(volume-weighted avg of ${agents.length} agents)`,
    selectedAgentId: 0,
    successRate: Math.round(weightedSuccessRate * 100) / 100,
    price: Math.round(weightedPrice * 1000) / 1000,
    expectedCostPer100Jobs: Math.round(totalCost * 100) / 100,
    expectedFailedPer100Jobs: Math.round(failedPer100 * 100) / 100,
    moneyWastedPer100Jobs: Math.round(wastedCost * 100) / 100,
  };
}

async function runBacktest(): Promise<void> {
  log.info('Fetching all agents with offerings...');
  const allAgents = await fetchAllAgentsWithOfferings();
  log.info(`Fetched ${allAgents.length} agents`);

  const results: RoutingResult[] = [];

  for (const cat of SERVICE_CATEGORIES) {
    const matching = matchAgentsToCategory(allAgents, cat.keywords);
    if (matching.length < 2) {
      log.info(`Skipping ${cat.name}: only ${matching.length} agents`);
      continue;
    }

    const random = simulateStrategy(matching, 'random', cat.keywords);
    const volumeWeighted = simulateVolumeWeightedRandom(matching, cat.keywords);
    const cheapest = simulateStrategy(matching, 'cheapest', cat.keywords);
    const quality = simulateStrategy(matching, 'quality', cat.keywords);

    const qualityVsRandomSavings =
      random.moneyWastedPer100Jobs - quality.moneyWastedPer100Jobs;
    const qualityVsCheapestSavings =
      cheapest.moneyWastedPer100Jobs - quality.moneyWastedPer100Jobs;

    results.push({
      category: cat.name,
      agentCount: matching.length,
      strategies: {
        random: volumeWeighted, // use volume-weighted as more realistic
        cheapest,
        quality,
      },
      qualityVsRandomSavings,
      qualityVsCheapestSavings,
    });
  }

  // Print results
  console.log('\n' + '='.repeat(80));
  console.log('BACKTEST: Quality Routing vs Random/Cheapest Routing');
  console.log('='.repeat(80));
  console.log(
    'Hypothesis: Using Thesis check_agent/find_agent to pick the highest-reliability',
  );
  console.log(
    'agent reduces failed jobs and wasted spend vs current routing (random/keyword).',
  );
  console.log('='.repeat(80) + '\n');

  for (const r of results) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`📋 ${r.category} (${r.agentCount} competing agents)`);
    console.log(`${'─'.repeat(70)}`);

    const { random, cheapest, quality } = r.strategies;

    console.log('\n  Strategy         │ Agent                    │ Success │ Price  │ Failed/100 │ Wasted/100');
    console.log('  ─────────────────┼──────────────────────────┼─────────┼────────┼────────────┼──────────');

    const formatRow = (label: string, s: StrategyResult) => {
      const agent = s.selectedAgent.substring(0, 24).padEnd(24);
      const sr = `${s.successRate}%`.padStart(7);
      const price = `$${s.price}`.padStart(6);
      const failed = `${s.expectedFailedPer100Jobs}`.padStart(10);
      const wasted = `$${s.moneyWastedPer100Jobs}`.padStart(9);
      console.log(`  ${label.padEnd(17)}│ ${agent} │${sr} │${price} │${failed} │${wasted}`);
    };

    formatRow('Random (current)', random);
    formatRow('Cheapest', cheapest);
    formatRow('Quality (Thesis)', quality);

    const failDiff = random.expectedFailedPer100Jobs - quality.expectedFailedPer100Jobs;
    if (failDiff > 0) {
      console.log(
        `\n  ✅ Quality routing prevents ${failDiff.toFixed(1)} extra failures per 100 jobs vs random routing`,
      );
    }

    if (r.qualityVsRandomSavings > 0) {
      console.log(
        `  💰 Saves $${r.qualityVsRandomSavings.toFixed(2)} in wasted fees per 100 jobs vs random`,
      );
    }
  }

  // Summary stats
  console.log(`\n${'='.repeat(80)}`);
  console.log('SUMMARY');
  console.log('='.repeat(80));

  const totalCategories = results.length;
  const avgFailReduction =
    results.reduce(
      (s, r) =>
        s +
        r.strategies.random.expectedFailedPer100Jobs -
        r.strategies.quality.expectedFailedPer100Jobs,
      0,
    ) / totalCategories;

  const avgSavings =
    results.reduce((s, r) => s + r.qualityVsRandomSavings, 0) / totalCategories;

  const worstCategory = results.reduce((worst, r) => {
    const failSpread =
      r.strategies.random.expectedFailedPer100Jobs -
      r.strategies.quality.expectedFailedPer100Jobs;
    const worstSpread =
      worst.strategies.random.expectedFailedPer100Jobs -
      worst.strategies.quality.expectedFailedPer100Jobs;
    return failSpread > worstSpread ? r : worst;
  });

  console.log(`\n  Categories tested: ${totalCategories}`);
  console.log(
    `  Avg failure reduction (quality vs random): ${avgFailReduction.toFixed(1)} fewer failures per 100 jobs`,
  );
  console.log(
    `  Avg cost savings (quality vs random): $${avgSavings.toFixed(2)} per 100 jobs`,
  );
  console.log(
    `  Biggest quality gap: ${worstCategory.category} (${(worstCategory.strategies.random.expectedFailedPer100Jobs - worstCategory.strategies.quality.expectedFailedPer100Jobs).toFixed(1)} fewer failures)`,
  );

  // Scale to ecosystem
  console.log(`\n  📊 Scaled to ecosystem (3.4M total ACP transactions):`);
  const totalTx = 3400000;
  const estFailsPreventedPerTx = avgFailReduction / 100;
  const totalFailsPrevented = Math.round(totalTx * estFailsPreventedPerTx);
  const estSavingsPerTx = avgSavings / 100;
  const totalSavings = Math.round(totalTx * estSavingsPerTx);
  console.log(
    `  Est. failures prevented: ${totalFailsPrevented.toLocaleString()}`,
  );
  console.log(`  Est. wasted fees saved: $${totalSavings.toLocaleString()}`);

  console.log('\n' + '='.repeat(80) + '\n');

  // Raw JSON for analysis
  console.log('\n--- RAW JSON ---');
  console.log(JSON.stringify(results, null, 2));
}

runBacktest().catch((e) => {
  log.error('Backtest failed', e);
  process.exit(1);
});

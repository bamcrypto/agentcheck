import { ComputedMetrics } from '../scoring/metrics.js';
import { RatingInfo } from '../scoring/rating.js';
import { ComparableAgent } from '../scoring/comparables.js';

/**
 * Format a single agent analysis response.
 */
export function formatAgentThesis(data: {
  agent: string;
  token: string;
  tokenAddress: string;
  mcap: number;
  priceUsd: number;
  thesisScore: number;
  rating: RatingInfo;
  metrics: ComputedMetrics;
  totalJobs: number;
  uniqueBuyers30d: number;
  dailyRevenue7d: number[];
  dailyJobs7d: number[];
  scoreHistory: number[];
  comparables: ComparableAgent[];
}): Record<string, unknown> {
  return {
    agent: data.agent,
    token: data.token,
    token_address: data.tokenAddress,
    mcap: Math.round(data.mcap),
    price_usd: data.priceUsd,
    thesis_score: data.thesisScore,
    rating: data.rating.rating,
    metrics: {
      monthly_revenue: Math.round(data.metrics.monthlyRevenue),
      revenue_to_mcap: round4(data.metrics.revenueToMcap),
      revenue_growth_30d: round4(data.metrics.revenueGrowth30d),
      job_velocity_7d: data.dailyJobs7d.reduce((a, b) => a + b, 0),
      job_velocity_trend: round4(data.metrics.jobVelocityTrend),
      success_rate: round4(data.metrics.successRate),
      total_jobs: data.totalJobs,
      unique_buyers_30d: data.uniqueBuyers30d,
      buyer_concentration_top3: round4(data.metrics.buyerConcentration),
      price_to_revenue: round2(data.metrics.priceToRevenue),
    },
    trend: {
      revenue_7d: data.dailyRevenue7d.map(Math.round),
      jobs_7d: data.dailyJobs7d,
      thesis_score_history: data.scoreHistory,
    },
    comparable_agents: data.comparables.map((c) => ({
      name: c.name,
      thesis_score: c.thesisScore,
      p_r_ratio: round2(c.priceToRevenue),
    })),
    summary: generateSummary(data),
  };
}

/**
 * Format an undervalued scan response.
 */
export function formatUndervaluedScan(data: {
  totalAnalysed: number;
  withRevenue: number;
  undervalued: Array<{
    agent: string;
    token: string;
    thesisScore: number;
    rating: string;
    mcap: number;
    monthlyRevenue: number;
    revenueToMcap: number;
    revenueGrowth30d: number;
    keySignal: string;
  }>;
  overvalued: Array<{
    agent: string;
    token: string;
    thesisScore: number;
    rating: string;
    mcap: number;
    monthlyRevenue: number;
    revenueToMcap: number;
    revenueGrowth30d: number;
    keySignal: string;
  }>;
  marketOverview: {
    medianPrRatio: number;
    meanThesisScore: number;
    agentsAbove80: number;
    agentsBelow20: number;
  };
}): Record<string, unknown> {
  return {
    scan_timestamp: new Date().toISOString(),
    total_agents_analysed: data.totalAnalysed,
    graduated_with_revenue: data.withRevenue,
    top_undervalued: data.undervalued.map((a) => ({
      agent: a.agent,
      token: a.token,
      thesis_score: a.thesisScore,
      rating: a.rating,
      mcap: Math.round(a.mcap),
      monthly_revenue: Math.round(a.monthlyRevenue),
      revenue_to_mcap: round4(a.revenueToMcap),
      revenue_growth_30d: round4(a.revenueGrowth30d),
      key_signal: a.keySignal,
    })),
    top_overvalued: data.overvalued.map((a) => ({
      agent: a.agent,
      token: a.token,
      thesis_score: a.thesisScore,
      rating: a.rating,
      mcap: Math.round(a.mcap),
      monthly_revenue: Math.round(a.monthlyRevenue),
      revenue_to_mcap: round4(a.revenueToMcap),
      revenue_growth_30d: round4(a.revenueGrowth30d),
      key_signal: a.keySignal,
    })),
    market_overview: {
      median_p_r_ratio: data.marketOverview.medianPrRatio,
      mean_thesis_score: data.marketOverview.meanThesisScore,
      agents_above_80: data.marketOverview.agentsAbove80,
      agents_below_20: data.marketOverview.agentsBelow20,
    },
  };
}

/**
 * Format a comparison response.
 */
export function formatComparison(agents: Array<{
  agent: string;
  token: string;
  thesisScore: number;
  rating: string;
  mcap: number;
  metrics: ComputedMetrics;
}>): Record<string, unknown> {
  const sorted = [...agents].sort((a, b) => b.thesisScore - a.thesisScore);
  const best = sorted[0];

  return {
    comparison_timestamp: new Date().toISOString(),
    agents: agents.map((a) => ({
      agent: a.agent,
      token: a.token,
      thesis_score: a.thesisScore,
      rating: a.rating,
      mcap: Math.round(a.mcap),
      monthly_revenue: Math.round(a.metrics.monthlyRevenue),
      revenue_to_mcap: round4(a.metrics.revenueToMcap),
      revenue_growth_30d: round4(a.metrics.revenueGrowth30d),
      job_velocity_trend: round4(a.metrics.jobVelocityTrend),
      success_rate: round4(a.metrics.successRate),
      buyer_concentration: round4(a.metrics.buyerConcentration),
      price_to_revenue: round2(a.metrics.priceToRevenue),
    })),
    verdict: `${best.agent} (${best.token}) has the strongest fundamentals with a thesis score of ${best.thesisScore}. ${generateComparisonVerdict(agents)}`,
  };
}

// --- Template generators ---

function generateSummary(data: {
  agent: string;
  metrics: ComputedMetrics;
  thesisScore: number;
  rating: RatingInfo;
  uniqueBuyers30d: number;
  totalJobs: number;
}): string {
  const parts: string[] = [];

  // Rating headline
  if (data.thesisScore >= 80) {
    parts.push(`Strong fundamentals suggest ${data.agent} is significantly undervalued.`);
  } else if (data.thesisScore >= 60) {
    parts.push(`Solid fundamentals indicate ${data.agent} is undervalued relative to its revenue generation.`);
  } else if (data.thesisScore >= 40) {
    parts.push(`${data.agent} appears fairly valued relative to its current performance.`);
  } else if (data.thesisScore >= 20) {
    parts.push(`${data.agent} appears overvalued — market cap exceeds what fundamentals support.`);
  } else {
    parts.push(`${data.agent} is significantly overvalued with weak or declining fundamentals.`);
  }

  // Revenue assessment
  if (data.metrics.revenueGrowth30d > 0.2) {
    parts.push(`Revenue growth is strong at ${(data.metrics.revenueGrowth30d * 100).toFixed(0)}% month-over-month.`);
  } else if (data.metrics.revenueGrowth30d > 0) {
    parts.push(`Revenue growth is modest but positive at ${(data.metrics.revenueGrowth30d * 100).toFixed(0)}% MoM.`);
  } else if (data.metrics.revenueGrowth30d < -0.1) {
    parts.push(`Revenue is declining at ${(data.metrics.revenueGrowth30d * 100).toFixed(0)}% MoM — concerning trend.`);
  }

  // Valuation ratio
  if (data.metrics.revenueToMcap > 0.5) {
    parts.push(`Revenue-to-mcap ratio of ${data.metrics.revenueToMcap.toFixed(3)} suggests significant undervaluation.`);
  } else if (data.metrics.revenueToMcap > 0.1) {
    parts.push(`Revenue-to-mcap ratio of ${data.metrics.revenueToMcap.toFixed(3)} is reasonable.`);
  }

  // Buyer concentration
  if (data.metrics.buyerConcentration < 0.3) {
    parts.push(`Distributed buyer base (top 3 = ${(data.metrics.buyerConcentration * 100).toFixed(0)}% of revenue) indicates resilient demand.`);
  } else if (data.metrics.buyerConcentration > 0.7) {
    parts.push(`High buyer concentration (top 3 = ${(data.metrics.buyerConcentration * 100).toFixed(0)}% of revenue) is a risk factor.`);
  }

  // Success rate
  if (data.metrics.successRate > 0.99) {
    parts.push(`Near-perfect success rate of ${(data.metrics.successRate * 100).toFixed(1)}%.`);
  } else if (data.metrics.successRate < 0.9) {
    parts.push(`Below-average success rate of ${(data.metrics.successRate * 100).toFixed(1)}% may impact growth.`);
  }

  return parts.join(' ');
}

function generateComparisonVerdict(agents: Array<{
  agent: string;
  token: string;
  thesisScore: number;
  metrics: ComputedMetrics;
}>): string {
  if (agents.length < 2) return '';

  const sorted = [...agents].sort((a, b) => b.thesisScore - a.thesisScore);
  const gap = sorted[0].thesisScore - sorted[1].thesisScore;

  if (gap > 20) {
    return `Clear advantage over ${sorted[1].agent} with a ${gap}-point thesis score lead.`;
  } else if (gap > 5) {
    return `Moderate advantage over ${sorted[1].agent} — ${gap}-point gap in thesis scores.`;
  }
  return `Close call — only ${gap} points separate the top two. Consider other factors.`;
}

// --- Helpers ---

function round2(n: number): number {
  if (!isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  if (!isFinite(n)) return 0;
  return Math.round(n * 10000) / 10000;
}

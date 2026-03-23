/**
 * Individual metric calculations for agent valuation.
 */

export interface RawAgentData {
  // Performance
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  expiredJobs: number;
  totalRevenueUsd: number;
  periodRevenueUsd: number; // 30-day revenue
  previousPeriodRevenueUsd: number; // prior 30-day revenue
  periodJobs: number;       // 30-day jobs
  uniqueBuyers: number;
  top3BuyerRevenuePct: number;
  offeringsCount: number;
  // Recent trends
  dailyRevenue7d: number[];
  dailyJobs7d: number[];
  previousWeekJobs: number;
  currentWeekJobs: number;
  // Token
  priceUsd: number;
  marketCap: number;
  holderCount: number;
  volume24h: number;
  liquidityUsd: number;
}

export interface ComputedMetrics {
  revenueToMcap: number;       // R/MC — annualized revenue / market cap
  revenueGrowth30d: number;    // RGR — month-over-month revenue growth rate
  revenuePersistence: number;  // 0-1 — fraction of periods with revenue
  jobVelocityTrend: number;    // JVT — current week jobs / previous week jobs
  successRate: number;         // SR — completed / (completed + failed + expired)
  buyerConcentration: number;  // BCI — top 3 buyers' share of revenue
  buyerScale: number;          // log-scaled unique buyer count
  jobScale: number;            // log-scaled total job count
  priceToRevenue: number;      // P/R — market cap / annualized revenue
  monthlyRevenue: number;      // raw monthly revenue
}

/**
 * Revenue-to-MCap Ratio (R/MC)
 * Higher = more undervalued (but backtest shows this mean-reverts).
 */
export function revenueToMcap(monthlyRevenue: number, marketCap: number): number {
  if (marketCap <= 0) return 0;
  return (monthlyRevenue * 12) / marketCap;
}

/**
 * Revenue Growth Rate (RGR)
 */
export function revenueGrowthRate(currentPeriodRevenue: number, previousPeriodRevenue: number): number {
  if (previousPeriodRevenue <= 0) {
    return currentPeriodRevenue > 0 ? 1.0 : 0;
  }
  return (currentPeriodRevenue - previousPeriodRevenue) / previousPeriodRevenue;
}

/**
 * Job Velocity Trend (JVT)
 */
export function jobVelocityTrend(currentWeekJobs: number, previousWeekJobs: number): number {
  if (previousWeekJobs <= 0) {
    return currentWeekJobs > 0 ? 2.0 : 1.0;
  }
  return currentWeekJobs / previousWeekJobs;
}

/**
 * Success Rate (SR)
 */
export function successRate(completed: number, failed: number, expired: number): number {
  const total = completed + failed + expired;
  if (total <= 0) return 0;
  return completed / total;
}

/**
 * Buyer Concentration Index (BCI)
 */
export function buyerConcentration(top3BuyerRevenuePct: number): number {
  return Math.min(Math.max(top3BuyerRevenuePct, 0), 1);
}

/**
 * Buyer Scale — log10 of unique buyer count, normalized.
 */
export function buyerScaleMetric(uniqueBuyers: number): number {
  return Math.log10(Math.max(1, uniqueBuyers));
}

/**
 * Job Scale — log10 of total job count, normalized.
 */
export function jobScaleMetric(totalJobs: number): number {
  return Math.log10(Math.max(1, totalJobs));
}

/**
 * Price-to-Revenue (P/R) Ratio
 */
export function priceToRevenue(marketCap: number, monthlyRevenue: number): number {
  const annualizedRevenue = monthlyRevenue * 12;
  if (annualizedRevenue <= 0) return Infinity;
  return marketCap / annualizedRevenue;
}

/**
 * Compute all metrics from raw data.
 */
export function computeAllMetrics(data: RawAgentData): ComputedMetrics {
  const monthlyRevenue = data.periodRevenueUsd;

  return {
    revenueToMcap: revenueToMcap(monthlyRevenue, data.marketCap),
    revenueGrowth30d: revenueGrowthRate(data.periodRevenueUsd, data.previousPeriodRevenueUsd),
    revenuePersistence: 1.0, // default — computed externally with multi-period data
    jobVelocityTrend: jobVelocityTrend(data.currentWeekJobs, data.previousWeekJobs),
    successRate: successRate(data.completedJobs, data.failedJobs, data.expiredJobs),
    buyerConcentration: buyerConcentration(data.top3BuyerRevenuePct),
    buyerScale: buyerScaleMetric(data.uniqueBuyers),
    jobScale: jobScaleMetric(data.totalJobs),
    priceToRevenue: priceToRevenue(data.marketCap, monthlyRevenue),
    monthlyRevenue,
  };
}

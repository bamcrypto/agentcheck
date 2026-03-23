import { computeForwardReturns, getAvailableDates, ForwardReturn } from './ground-truth.js';
import { ScoringWeights, DEFAULT_WEIGHTS } from '../config/weights.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('backtest');

export interface BacktestResult {
  totalPeriods: number;
  totalDataPoints: number;
  spearmanCorrelation7d: number;
  spearmanCorrelation14d: number;
  spearmanCorrelation30d: number;
  topQuintileReturn30d: number;   // avg return of top 20% by thesis score
  bottomQuintileReturn30d: number; // avg return of bottom 20%
  spread: number;                   // top quintile - bottom quintile
  weights: ScoringWeights;
}

/**
 * Compute Spearman rank correlation between two arrays.
 */
function spearmanCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length < 3) return 0;

  const n = x.length;

  // Compute ranks
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

  // d^2 formula
  let dSquaredSum = 0;
  for (let i = 0; i < n; i++) {
    const d = xRanks[i] - yRanks[i];
    dSquaredSum += d * d;
  }

  return 1 - (6 * dSquaredSum) / (n * (n * n - 1));
}

/**
 * Run a full backtest over all available historical dates.
 */
export async function runBacktest(weights?: ScoringWeights): Promise<BacktestResult> {
  const usedWeights = weights ?? DEFAULT_WEIGHTS;
  const dates = await getAvailableDates();

  // We need at least 30 days of forward data, so skip last 30 dates
  const backtestDates = dates.slice(0, -30);

  if (backtestDates.length === 0) {
    log.warn('Insufficient data for backtest — need at least 30 days of snapshots');
    return emptyResult(usedWeights);
  }

  // Sample weekly (every 7th date)
  const sampledDates = backtestDates.filter((_, i) => i % 7 === 0);

  const allReturns: ForwardReturn[] = [];

  for (const date of sampledDates) {
    const returns = await computeForwardReturns(date);
    allReturns.push(...returns);
  }

  if (allReturns.length < 10) {
    log.warn(`Only ${allReturns.length} data points — insufficient for meaningful backtest`);
    return emptyResult(usedWeights);
  }

  // Compute correlations
  const scores = allReturns.map((r) => r.thesisScore);
  const returns7d = allReturns.map((r) => r.return7d);
  const returns14d = allReturns.map((r) => r.return14d);
  const returns30d = allReturns.map((r) => r.return30d);

  const corr7d = spearmanCorrelation(scores, returns7d);
  const corr14d = spearmanCorrelation(scores, returns14d);
  const corr30d = spearmanCorrelation(scores, returns30d);

  // Quintile analysis
  const sorted = [...allReturns].sort((a, b) => b.thesisScore - a.thesisScore);
  const quintileSize = Math.floor(sorted.length / 5);

  const topQuintile = sorted.slice(0, quintileSize);
  const bottomQuintile = sorted.slice(-quintileSize);

  const avgReturn = (arr: ForwardReturn[]): number =>
    arr.length > 0 ? arr.reduce((sum, r) => sum + r.return30d, 0) / arr.length : 0;

  const topReturn = avgReturn(topQuintile);
  const bottomReturn = avgReturn(bottomQuintile);

  const result: BacktestResult = {
    totalPeriods: sampledDates.length,
    totalDataPoints: allReturns.length,
    spearmanCorrelation7d: Math.round(corr7d * 1000) / 1000,
    spearmanCorrelation14d: Math.round(corr14d * 1000) / 1000,
    spearmanCorrelation30d: Math.round(corr30d * 1000) / 1000,
    topQuintileReturn30d: Math.round(topReturn * 10000) / 10000,
    bottomQuintileReturn30d: Math.round(bottomReturn * 10000) / 10000,
    spread: Math.round((topReturn - bottomReturn) * 10000) / 10000,
    weights: usedWeights,
  };

  log.info('Backtest results:', result);
  return result;
}

function emptyResult(weights: ScoringWeights): BacktestResult {
  return {
    totalPeriods: 0,
    totalDataPoints: 0,
    spearmanCorrelation7d: 0,
    spearmanCorrelation14d: 0,
    spearmanCorrelation30d: 0,
    topQuintileReturn30d: 0,
    bottomQuintileReturn30d: 0,
    spread: 0,
    weights,
  };
}

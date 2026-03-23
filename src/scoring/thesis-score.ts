import { ComputedMetrics } from './metrics.js';
import { ScoringWeights, DEFAULT_WEIGHTS } from '../config/weights.js';

/**
 * Normalize a value to 0-100 range using min-max bounds.
 */
export function normalizeMinMax(value: number, min: number, max: number): number {
  if (max <= min) return 50;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

/**
 * Normalize a value using percentile ranking within a cohort.
 */
export function normalizePercentile(value: number, allValues: number[]): number {
  if (allValues.length === 0) return 50;
  const sorted = [...allValues].sort((a, b) => a - b);
  const rank = sorted.filter((v) => v < value).length;
  return (rank / sorted.length) * 100;
}

// Normalization bounds for each metric
const BOUNDS = {
  revenueToMcap: { min: 0, max: 1.0 },
  revenueGrowth: { min: -0.5, max: 2.0 },
  revenuePersistence: { min: 0, max: 1.0 },
  successRate: { min: 0.7, max: 1.0 },
  buyerScale: { min: 0, max: 4 },     // log10(10000) = 4
  jobScale: { min: 0, max: 6 },       // log10(1000000) = 6
} as const;

/**
 * Compute the composite Thesis Score (0-100).
 *
 * Uses the backtest-proven contrarian model where revenue-to-mcap
 * has a NEGATIVE weight (penalizes agents at peak performance).
 */
export function computeThesisScore(
  metrics: ComputedMetrics,
  weights: ScoringWeights = DEFAULT_WEIGHTS,
): number {
  const normalized = {
    revenueToMcap: normalizeMinMax(metrics.revenueToMcap, BOUNDS.revenueToMcap.min, BOUNDS.revenueToMcap.max),
    revenueGrowth: normalizeMinMax(metrics.revenueGrowth30d, BOUNDS.revenueGrowth.min, BOUNDS.revenueGrowth.max),
    revenuePersistence: normalizeMinMax(metrics.revenuePersistence, BOUNDS.revenuePersistence.min, BOUNDS.revenuePersistence.max),
    successRate: normalizeMinMax(metrics.successRate, BOUNDS.successRate.min, BOUNDS.successRate.max),
    buyerScale: normalizeMinMax(metrics.buyerScale, BOUNDS.buyerScale.min, BOUNDS.buyerScale.max),
    jobScale: normalizeMinMax(metrics.jobScale, BOUNDS.jobScale.min, BOUNDS.jobScale.max),
  };

  const score =
    weights.revenueToMcap * normalized.revenueToMcap +
    weights.revenueGrowth * normalized.revenueGrowth +
    weights.revenuePersistence * normalized.revenuePersistence +
    weights.successRate * normalized.successRate +
    weights.buyerScale * normalized.buyerScale +
    weights.jobScale * normalized.jobScale;

  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Compute thesis scores for multiple agents using relative (percentile) normalization.
 */
export function computeThesisScoresRelative(
  allMetrics: Array<{ address: string; metrics: ComputedMetrics }>,
  weights: ScoringWeights = DEFAULT_WEIGHTS,
): Array<{ address: string; score: number }> {
  if (allMetrics.length === 0) return [];

  const values = {
    rmc: allMetrics.map((m) => m.metrics.revenueToMcap),
    rgr: allMetrics.map((m) => m.metrics.revenueGrowth30d),
    rp: allMetrics.map((m) => m.metrics.revenuePersistence),
    sr: allMetrics.map((m) => m.metrics.successRate),
    bs: allMetrics.map((m) => m.metrics.buyerScale),
    js: allMetrics.map((m) => m.metrics.jobScale),
  };

  return allMetrics.map((entry) => {
    const score =
      weights.revenueToMcap * normalizePercentile(entry.metrics.revenueToMcap, values.rmc) +
      weights.revenueGrowth * normalizePercentile(entry.metrics.revenueGrowth30d, values.rgr) +
      weights.revenuePersistence * normalizePercentile(entry.metrics.revenuePersistence, values.rp) +
      weights.successRate * normalizePercentile(entry.metrics.successRate, values.sr) +
      weights.buyerScale * normalizePercentile(entry.metrics.buyerScale, values.bs) +
      weights.jobScale * normalizePercentile(entry.metrics.jobScale, values.js);

    return {
      address: entry.address,
      score: Math.round(Math.max(0, Math.min(100, score))),
    };
  });
}

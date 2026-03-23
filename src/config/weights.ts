/**
 * Thesis Score weights — tuned via epoch backtest (2026-03-22).
 *
 * Key finding: a CONTRARIAN approach works best. High revenue-to-mcap
 * (looking "cheap") is actually a negative signal — those agents are
 * at peak performance and tend to mean-revert. The winning model:
 * - Penalizes high rev/mcap (anti-yield)
 * - Rewards revenue growth momentum
 * - Rewards revenue persistence across epochs
 * - Heavily weights buyer scale and job scale (ecosystem adoption)
 *
 * Backtest result (epochs 1-5):
 *   Revenue correlation: +0.090 (moderate)
 *   Rank correlation:    +0.162 (moderate)
 *   Quintile spread:     +143.1% (strong)
 */

export interface ScoringWeights {
  revenueToMcap: number;   // w1 — Revenue/MCap ratio (NEGATIVE = contrarian)
  revenueGrowth: number;   // w2 — Revenue growth momentum
  revenuePersistence: number; // w3 — Consistency of revenue across epochs
  successRate: number;     // w4 — Job completion reliability
  buyerScale: number;      // w5 — Unique buyer count (adoption breadth)
  jobScale: number;        // w6 — Total job volume (usage depth)
}

// Backtest-proven weights (anti-yield contrarian model)
export const DEFAULT_WEIGHTS: ScoringWeights = {
  revenueToMcap: -0.20,     // NEGATIVE: penalize "cheap" agents at peak
  revenueGrowth: 0.30,      // Strong weight on momentum
  revenuePersistence: 0.20,  // Reward consistency
  successRate: 0.15,         // Reliability matters
  buyerScale: 0.25,          // Adoption breadth is key
  jobScale: 0.30,            // Usage depth is key
};

// Legacy weights (pre-backtest, yield-focused)
export const LEGACY_WEIGHTS: ScoringWeights = {
  revenueToMcap: 0.30,
  revenueGrowth: 0.25,
  revenuePersistence: 0.10,
  successRate: 0.15,
  buyerScale: 0.10,
  jobScale: 0.10,
};

// Rating bucket thresholds
export const RATING_BUCKETS = {
  STRONG_BUY: { min: 80, max: 100, label: 'strong_buy', description: 'Strong fundamentals with growth momentum and broad adoption' },
  BUY: { min: 60, max: 79, label: 'buy', description: 'Good fundamentals with positive trajectory' },
  HOLD: { min: 40, max: 59, label: 'hold', description: 'Average fundamentals — watch for momentum shifts' },
  OVERVALUED: { min: 20, max: 39, label: 'overvalued', description: 'Weak fundamentals or declining momentum' },
  AVOID: { min: 0, max: 19, label: 'avoid', description: 'Poor fundamentals with declining usage' },
} as const;

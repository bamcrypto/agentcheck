# Thesis Autoresearch Program

## Objective
Optimise the scoring weights in `src/config/weights.ts` to maximise the Spearman rank correlation between thesis scores and 30-day forward token returns.

## Single Metric
**Spearman rank correlation** between thesis score (at time T) and token price return (T to T+30d).

Target: > 0.20 correlation (meaningful predictive power).

## Process

1. Read current weights from `src/config/weights.ts`
2. Run backtest: `npx tsx src/index.ts backtest`
3. Record the correlation and spread
4. Modify one or two weights (ensure they still sum to 1.0)
5. Re-run backtest
6. If correlation improved: keep new weights
7. If correlation decreased: revert to previous weights
8. Repeat steps 4-7

## Constraints
- All weights must be between 0.05 and 0.50
- Weights must sum to 1.0
- Change at most 2 weights per iteration
- Run at least 10 iterations per session

## Weight Descriptions
- `revenueToMcap` (w1): How much does revenue yield predict returns?
- `revenueGrowth` (w2): How much does revenue momentum predict returns?
- `jobVelocity` (w3): How much does job activity trend predict returns?
- `successRate` (w4): How much does reliability predict returns?
- `buyerDiversity` (w5): How much does buyer distribution predict returns?

## Notes
- The backtest requires sufficient historical daily snapshots (30+ days minimum)
- Start collecting snapshots immediately — every day of data makes the backtest more reliable
- Early iterations may show no signal — this is expected until enough data accumulates

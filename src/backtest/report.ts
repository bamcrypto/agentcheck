import { BacktestResult } from './run-backtest.js';

/**
 * Generate a human-readable backtest report.
 */
export function generateBacktestReport(result: BacktestResult): string {
  const lines: string[] = [
    '=== THESIS BACKTEST REPORT ===',
    '',
    `Periods tested: ${result.totalPeriods} (weekly samples)`,
    `Data points: ${result.totalDataPoints} agent-period observations`,
    '',
    '--- Predictive Accuracy (Spearman Rank Correlation) ---',
    `  7-day forward returns:  ${formatCorrelation(result.spearmanCorrelation7d)}`,
    `  14-day forward returns: ${formatCorrelation(result.spearmanCorrelation14d)}`,
    `  30-day forward returns: ${formatCorrelation(result.spearmanCorrelation30d)}`,
    '',
    '--- Quintile Performance (30-day) ---',
    `  Top 20% (highest thesis score):    ${formatPct(result.topQuintileReturn30d)} avg return`,
    `  Bottom 20% (lowest thesis score):  ${formatPct(result.bottomQuintileReturn30d)} avg return`,
    `  Spread (long top / short bottom):  ${formatPct(result.spread)}`,
    '',
    '--- Scoring Weights Used ---',
    `  Revenue/MCap:      ${result.weights.revenueToMcap}`,
    `  Revenue Growth:    ${result.weights.revenueGrowth}`,
    `  Rev Persistence:   ${result.weights.revenuePersistence}`,
    `  Success Rate:      ${result.weights.successRate}`,
    `  Buyer Scale:       ${result.weights.buyerScale}`,
    `  Job Scale:         ${result.weights.jobScale}`,
    '',
    '--- Interpretation ---',
    interpretResults(result),
    '',
    '================================',
  ];

  return lines.join('\n');
}

function formatCorrelation(corr: number): string {
  const sign = corr >= 0 ? '+' : '';
  const strength = Math.abs(corr) > 0.3 ? 'strong'
    : Math.abs(corr) > 0.15 ? 'moderate'
      : Math.abs(corr) > 0.05 ? 'weak' : 'negligible';
  return `${sign}${corr.toFixed(3)} (${strength})`;
}

function formatPct(value: number): string {
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;
}

function interpretResults(result: BacktestResult): string {
  if (result.totalDataPoints < 10) {
    return 'Insufficient data for meaningful interpretation. Continue collecting snapshots.';
  }

  const parts: string[] = [];

  if (result.spearmanCorrelation30d > 0.2) {
    parts.push('The thesis score shows meaningful predictive power for 30-day returns.');
  } else if (result.spearmanCorrelation30d > 0.05) {
    parts.push('The thesis score shows weak but positive predictive signal. Weight optimisation may improve this.');
  } else {
    parts.push('The thesis score currently shows limited predictive power. Autoresearch weight optimisation recommended.');
  }

  if (result.spread > 0.05) {
    parts.push(`A ${formatPct(result.spread)} spread between top and bottom quintiles suggests the scoring model can differentiate winners from losers.`);
  } else if (result.spread > 0) {
    parts.push('Positive but narrow quintile spread — the model is directionally correct but not strongly differentiating.');
  } else {
    parts.push('Negative quintile spread — the model may need significant recalibration.');
  }

  return parts.join(' ');
}

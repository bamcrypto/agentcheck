import { createLogger } from '../utils/logger.js';

const log = createLogger('ta');

export interface TAResult {
  available: boolean;
  period: string;
  data_points: number;
  rsi_14: number;
  rsi_signal: 'oversold' | 'neutral' | 'overbought';
  macd: { macd: number; signal: number; histogram: number; trend: 'bullish' | 'bearish' | 'neutral' };
  bollinger: { upper: number; middle: number; lower: number; position: 'above' | 'within' | 'below' };
  sma_20: number;
  sma_50: number;
  ema_12: number;
  ema_26: number;
  trend: 'strong_bullish' | 'bullish' | 'neutral' | 'bearish' | 'strong_bearish';
  current_price: number;
  support: number;
  resistance: number;
  summary: string;
}

const EMPTY_RESULT: TAResult = {
  available: false,
  period: '',
  data_points: 0,
  rsi_14: 50,
  rsi_signal: 'neutral',
  macd: { macd: 0, signal: 0, histogram: 0, trend: 'neutral' },
  bollinger: { upper: 0, middle: 0, lower: 0, position: 'within' },
  sma_20: 0,
  sma_50: 0,
  ema_12: 0,
  ema_26: 0,
  trend: 'neutral',
  current_price: 0,
  support: 0,
  resistance: 0,
  summary: 'Insufficient data for technical analysis.',
};

/**
 * Compute full technical analysis from price history.
 * @param prices Array of [timestamp, price] tuples (oldest first)
 */
export function computeTA(prices: [number, number][]): TAResult {
  if (prices.length < 30) {
    return { ...EMPTY_RESULT, data_points: prices.length };
  }

  const closes = prices.map(p => p[1]);
  const currentPrice = closes[closes.length - 1];

  // RSI (14-period)
  const rsi = computeRSI(closes, 14);
  const rsiSignal: TAResult['rsi_signal'] =
    rsi < 30 ? 'oversold' : rsi > 70 ? 'overbought' : 'neutral';

  // MACD (12, 26, 9)
  const ema12 = computeEMA(closes, 12);
  const ema26 = computeEMA(closes, 26);
  const macdLine = ema12 - ema26;
  const macdValues = closes.map((_, i) => {
    if (i < 26) return 0;
    const e12 = computeEMAAt(closes, 12, i);
    const e26 = computeEMAAt(closes, 26, i);
    return e12 - e26;
  }).slice(26);
  const signalLine = macdValues.length >= 9 ? computeEMAFromArray(macdValues, 9) : 0;
  const histogram = macdLine - signalLine;
  const macdTrend: 'bullish' | 'bearish' | 'neutral' =
    histogram > 0 && macdLine > signalLine ? 'bullish' :
    histogram < 0 && macdLine < signalLine ? 'bearish' : 'neutral';

  // Bollinger Bands (20-period, 2 std dev)
  const sma20 = computeSMA(closes, 20);
  const stdDev = computeStdDev(closes.slice(-20), sma20);
  const bollingerUpper = sma20 + 2 * stdDev;
  const bollingerLower = sma20 - 2 * stdDev;
  const bollingerPosition: 'above' | 'within' | 'below' =
    currentPrice > bollingerUpper ? 'above' :
    currentPrice < bollingerLower ? 'below' : 'within';

  // SMAs
  const sma50 = closes.length >= 50 ? computeSMA(closes, 50) : sma20;

  // Support/Resistance (simple: recent lows/highs)
  const recent = closes.slice(-20);
  const support = Math.min(...recent);
  const resistance = Math.max(...recent);

  // Overall trend
  let bullishSignals = 0;
  let bearishSignals = 0;

  if (currentPrice > sma20) bullishSignals++; else bearishSignals++;
  if (currentPrice > sma50) bullishSignals++; else bearishSignals++;
  if (ema12 > ema26) bullishSignals++; else bearishSignals++;
  if (macdTrend === 'bullish') bullishSignals++; else if (macdTrend === 'bearish') bearishSignals++;
  if (rsi > 50) bullishSignals++; else bearishSignals++;

  let trend: TAResult['trend'];
  if (bullishSignals >= 4) trend = 'strong_bullish';
  else if (bullishSignals >= 3) trend = 'bullish';
  else if (bearishSignals >= 4) trend = 'strong_bearish';
  else if (bearishSignals >= 3) trend = 'bearish';
  else trend = 'neutral';

  // Summary
  const trendWord = trend.replace('strong_', 'strongly ').replace('_', ' ');
  const summary = `${trendWord.charAt(0).toUpperCase() + trendWord.slice(1)} trend. ` +
    `RSI: ${rsi.toFixed(1)} (${rsiSignal}). ` +
    `MACD: ${macdTrend}. ` +
    `Price ${bollingerPosition} Bollinger bands. ` +
    `Support: $${support.toPrecision(4)}, Resistance: $${resistance.toPrecision(4)}.`;

  return {
    available: true,
    period: '14d hourly',
    data_points: prices.length,
    rsi_14: round(rsi),
    rsi_signal: rsiSignal,
    macd: {
      macd: round(macdLine),
      signal: round(signalLine),
      histogram: round(histogram),
      trend: macdTrend,
    },
    bollinger: {
      upper: round(bollingerUpper),
      middle: round(sma20),
      lower: round(bollingerLower),
      position: bollingerPosition,
    },
    sma_20: round(sma20),
    sma_50: round(sma50),
    ema_12: round(ema12),
    ema_26: round(ema26),
    trend,
    current_price: round(currentPrice),
    support: round(support),
    resistance: round(resistance),
    summary,
  };
}

// ─── Math helpers ────────────────────────────────────────────────────

function computeRSI(closes: number[], period: number): number {
  if (closes.length < period + 1) return 50;

  let gainSum = 0;
  let lossSum = 0;

  for (let i = closes.length - period; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) gainSum += change;
    else lossSum += Math.abs(change);
  }

  const avgGain = gainSum / period;
  const avgLoss = lossSum / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function computeSMA(data: number[], period: number): number {
  const slice = data.slice(-period);
  return slice.reduce((s, v) => s + v, 0) / slice.length;
}

function computeEMA(data: number[], period: number): number {
  return computeEMAAt(data, period, data.length - 1);
}

function computeEMAAt(data: number[], period: number, endIdx: number): number {
  const k = 2 / (period + 1);
  const start = Math.max(0, endIdx - period * 3); // use 3x period for warmup
  let ema = data[start];
  for (let i = start + 1; i <= endIdx; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  return ema;
}

function computeEMAFromArray(data: number[], period: number): number {
  const k = 2 / (period + 1);
  let ema = data[0];
  for (let i = 1; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k);
  }
  return ema;
}

function computeStdDev(data: number[], mean: number): number {
  const variance = data.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / data.length;
  return Math.sqrt(variance);
}

function round(n: number): number {
  if (Math.abs(n) < 0.001) return parseFloat(n.toPrecision(4));
  return Math.round(n * 10000) / 10000;
}

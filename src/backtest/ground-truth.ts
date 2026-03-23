import { getDb } from '../data/database.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('ground-truth');

export interface HistoricalDataPoint {
  agentAddress: string;
  date: string;
  thesisScore: number;
  priceUsd: number;
  marketCap: number;
  monthlyRevenue: number;
  revenueToMcap: number;
}

export interface ForwardReturn {
  agentAddress: string;
  date: string;
  thesisScore: number;
  return7d: number;
  return14d: number;
  return30d: number;
}

/**
 * Get historical snapshots for all agents at a specific date.
 */
export async function getSnapshotsAtDate(date: string): Promise<HistoricalDataPoint[]> {
  const database = await getDb();
  const result = database.exec(
    `SELECT agent_address, date, thesis_score, price_usd, market_cap,
            monthly_revenue, revenue_to_mcap
     FROM daily_snapshots WHERE date = ?`,
    [date],
  );

  if (!result.length) return [];

  return result[0].values.map((row: unknown[]) => ({
    agentAddress: row[0] as string,
    date: row[1] as string,
    thesisScore: (row[2] as number) || 0,
    priceUsd: (row[3] as number) || 0,
    marketCap: (row[4] as number) || 0,
    monthlyRevenue: (row[5] as number) || 0,
    revenueToMcap: (row[6] as number) || 0,
  }));
}

/**
 * Compute forward returns for agents at a given date.
 * Looks up token prices at date + 7d, +14d, +30d.
 */
export async function computeForwardReturns(date: string): Promise<ForwardReturn[]> {
  const snapshots = await getSnapshotsAtDate(date);
  if (snapshots.length === 0) return [];

  const database = await getDb();
  const results: ForwardReturn[] = [];

  for (const snapshot of snapshots) {
    if (snapshot.priceUsd <= 0) continue;

    const baseDate = new Date(snapshot.date);
    const dates = {
      '7d': new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      '14d': new Date(baseDate.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      '30d': new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    };

    const futurePrice = (targetDate: string): number => {
      const r = database.exec(
        `SELECT price_usd FROM daily_snapshots
         WHERE agent_address = ? AND date = ?`,
        [snapshot.agentAddress, targetDate],
      );
      return (r[0]?.values[0]?.[0] as number) || 0;
    };

    const price7d = futurePrice(dates['7d']);
    const price14d = futurePrice(dates['14d']);
    const price30d = futurePrice(dates['30d']);

    results.push({
      agentAddress: snapshot.agentAddress,
      date: snapshot.date,
      thesisScore: snapshot.thesisScore,
      return7d: price7d > 0 ? (price7d - snapshot.priceUsd) / snapshot.priceUsd : 0,
      return14d: price14d > 0 ? (price14d - snapshot.priceUsd) / snapshot.priceUsd : 0,
      return30d: price30d > 0 ? (price30d - snapshot.priceUsd) / snapshot.priceUsd : 0,
    });
  }

  return results;
}

/**
 * Get all unique dates in daily_snapshots for backtest iteration.
 */
export async function getAvailableDates(): Promise<string[]> {
  const database = await getDb();
  const result = database.exec(
    'SELECT DISTINCT date FROM daily_snapshots ORDER BY date ASC',
  );
  if (!result.length) return [];
  return result[0].values.map((row: unknown[]) => row[0] as string);
}

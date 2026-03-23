import { getDb } from '../data/database.js';

export interface ComparableAgent {
  name: string;
  ticker: string;
  agentAddress: string;
  thesisScore: number;
  priceToRevenue: number;
  marketCap: number;
  monthlyRevenue: number;
}

/**
 * Find comparable agents for context.
 * Returns agents with similar revenue profiles, sorted by thesis score.
 */
export async function findComparableAgents(
  agentAddress: string,
  monthlyRevenue: number,
  limit: number = 5,
): Promise<ComparableAgent[]> {
  const database = await getDb();

  // Find agents with similar monthly revenue (within 0.5x-2x range)
  const minRevenue = monthlyRevenue * 0.3;
  const maxRevenue = monthlyRevenue * 3.0;

  const result = database.exec(
    `SELECT
       a.name, a.ticker, a.agent_address,
       s.thesis_score, s.market_cap, s.monthly_revenue,
       CASE WHEN s.monthly_revenue > 0 THEN s.market_cap / (s.monthly_revenue * 12) ELSE 999 END as p_r
     FROM daily_snapshots s
     JOIN agents a ON a.agent_address = s.agent_address
     WHERE s.agent_address != ?
       AND s.monthly_revenue BETWEEN ? AND ?
       AND s.date = (SELECT MAX(date) FROM daily_snapshots WHERE agent_address = s.agent_address)
     ORDER BY ABS(s.monthly_revenue - ?) ASC
     LIMIT ?`,
    [agentAddress, minRevenue, maxRevenue, monthlyRevenue, limit],
  );

  if (!result.length) return [];

  return result[0].values.map((row: unknown[]) => ({
    name: (row[0] as string) || 'Unknown',
    ticker: (row[1] as string) || '',
    agentAddress: row[2] as string,
    thesisScore: (row[3] as number) || 0,
    marketCap: (row[4] as number) || 0,
    monthlyRevenue: (row[5] as number) || 0,
    priceToRevenue: (row[6] as number) || 0,
  }));
}

/**
 * Get market-wide statistics for context.
 */
export async function getMarketOverview(): Promise<{
  totalAgents: number;
  agentsWithRevenue: number;
  medianPrRatio: number;
  meanThesisScore: number;
  agentsAbove80: number;
  agentsBelow20: number;
}> {
  const database = await getDb();

  // Get latest snapshots for all agents
  const result = database.exec(`
    SELECT thesis_score,
           CASE WHEN monthly_revenue > 0 THEN market_cap / (monthly_revenue * 12) ELSE NULL END as p_r,
           monthly_revenue
    FROM daily_snapshots s
    WHERE s.date = (SELECT MAX(date) FROM daily_snapshots WHERE agent_address = s.agent_address)
  `);

  if (!result.length || !result[0].values.length) {
    return {
      totalAgents: 0,
      agentsWithRevenue: 0,
      medianPrRatio: 0,
      meanThesisScore: 0,
      agentsAbove80: 0,
      agentsBelow20: 0,
    };
  }

  const rows = result[0].values;
  const scores = rows.map((r: unknown[]) => r[0] as number).filter((s: number | null) => s != null);
  const prRatios = rows.map((r: unknown[]) => r[1] as number).filter((p: number | null) => p != null && isFinite(p as number));
  const withRevenue = rows.filter((r: unknown[]) => (r[2] as number) > 0).length;

  const sortedPr = prRatios.sort((a: number, b: number) => a - b);
  const medianPr = sortedPr.length > 0
    ? sortedPr[Math.floor(sortedPr.length / 2)]
    : 0;

  const meanScore = scores.length > 0
    ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length
    : 0;

  return {
    totalAgents: rows.length,
    agentsWithRevenue: withRevenue,
    medianPrRatio: Math.round(medianPr * 10) / 10,
    meanThesisScore: Math.round(meanScore),
    agentsAbove80: scores.filter((s: number) => s >= 80).length,
    agentsBelow20: scores.filter((s: number) => s < 20).length,
  };
}

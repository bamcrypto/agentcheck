import { ethers } from 'ethers';
import { getProvider, getLogsChunked, getBlockTimestamp } from '../utils/rpc.js';
import { ACP_CONTRACTS } from '../config/contracts.js';
import { insertJobEvent, upsertAgent, insertAgentMetrics, getDb } from './database.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('agent-data');

// ACP event signatures (to be confirmed after contract discovery)
// These are placeholder ABIs — replace with actual ACP contract ABIs
const JOB_CREATED_TOPIC = ethers.id('JobCreated(uint256,address,address,uint256)');
const JOB_COMPLETED_TOPIC = ethers.id('JobCompleted(uint256,address,uint256)');
const JOB_FAILED_TOPIC = ethers.id('JobFailed(uint256,address)');

const JOB_EVENT_ABI = [
  'event JobCreated(uint256 indexed jobId, address indexed agent, address indexed buyer, uint256 amount)',
  'event JobCompleted(uint256 indexed jobId, address indexed agent, uint256 payout)',
  'event JobFailed(uint256 indexed jobId, address indexed agent)',
];

/**
 * Fetch job events from ACP contracts for a given block range.
 */
export async function fetchJobEvents(fromBlock: number, toBlock: number): Promise<void> {
  if (!ACP_CONTRACTS.jobFactory) {
    log.warn('ACP job factory address not configured — skipping job event fetch');
    return;
  }

  const iface = new ethers.Interface(JOB_EVENT_ABI);

  // Fetch all job-related events
  for (const topic of [JOB_CREATED_TOPIC, JOB_COMPLETED_TOPIC, JOB_FAILED_TOPIC]) {
    try {
      const logs = await getLogsChunked({
        address: ACP_CONTRACTS.jobFactory,
        topics: [topic],
        fromBlock,
        toBlock,
      });

      for (const rawLog of logs) {
        try {
          const parsed = iface.parseLog({ topics: rawLog.topics as string[], data: rawLog.data });
          if (!parsed) continue;

          const timestamp = await getBlockTimestamp(rawLog.blockNumber);
          const eventType = parsed.name === 'JobCreated' ? 'created'
            : parsed.name === 'JobCompleted' ? 'completed' : 'failed';

          await insertJobEvent({
            txHash: rawLog.transactionHash,
            blockNumber: rawLog.blockNumber,
            timestamp: new Date(timestamp * 1000).toISOString(),
            agentAddress: parsed.args[1] ?? parsed.args.agent,
            buyerAddress: eventType === 'created' ? (parsed.args[2] ?? parsed.args.buyer) : '',
            jobId: (parsed.args[0] ?? parsed.args.jobId)?.toString(),
            eventType,
            amountUsd: eventType !== 'failed'
              ? parseFloat(ethers.formatUnits(parsed.args[parsed.args.length - 1] ?? 0, 18))
              : 0,
          });
        } catch (e) {
          log.error('Failed to parse log', e);
        }
      }

      log.info(`Fetched ${logs.length} ${topic === JOB_CREATED_TOPIC ? 'created' : topic === JOB_COMPLETED_TOPIC ? 'completed' : 'failed'} events from blocks ${fromBlock}-${toBlock}`);
    } catch (e) {
      log.error(`Failed to fetch events for topic`, e);
    }
  }
}

/**
 * Compute aggregate metrics for a specific agent from stored job events.
 */
export async function computeAgentMetrics(agentAddress: string): Promise<{
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  expiredJobs: number;
  totalRevenueUsd: number;
  periodRevenueUsd: number;
  periodJobs: number;
  uniqueBuyers: number;
  top3BuyerRevenuePct: number;
}> {
  const database = await getDb();
  const now = new Date().toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Total counts
  const totalResult = database.exec(
    `SELECT
       COUNT(CASE WHEN event_type = 'created' THEN 1 END) as total,
       COUNT(CASE WHEN event_type = 'completed' THEN 1 END) as completed,
       COUNT(CASE WHEN event_type = 'failed' THEN 1 END) as failed,
       SUM(CASE WHEN event_type = 'completed' THEN amount_usd ELSE 0 END) as total_revenue
     FROM job_events WHERE agent_address = ?`,
    [agentAddress],
  );

  const totals = totalResult[0]?.values[0] ?? [0, 0, 0, 0];

  // Period metrics (last 30 days)
  const periodResult = database.exec(
    `SELECT
       COUNT(CASE WHEN event_type = 'completed' THEN 1 END) as period_jobs,
       SUM(CASE WHEN event_type = 'completed' THEN amount_usd ELSE 0 END) as period_revenue,
       COUNT(DISTINCT buyer_address) as unique_buyers
     FROM job_events WHERE agent_address = ? AND timestamp >= ?`,
    [agentAddress, thirtyDaysAgo],
  );

  const period = periodResult[0]?.values[0] ?? [0, 0, 0];

  // Buyer concentration (top 3 buyers' share of revenue)
  const buyerResult = database.exec(
    `SELECT buyer_address, SUM(amount_usd) as buyer_revenue
     FROM job_events
     WHERE agent_address = ? AND event_type = 'completed' AND timestamp >= ?
     GROUP BY buyer_address
     ORDER BY buyer_revenue DESC
     LIMIT 3`,
    [agentAddress, thirtyDaysAgo],
  );

  const totalPeriodRevenue = (period[1] as number) || 0;
  let top3Revenue = 0;
  if (buyerResult.length && buyerResult[0].values.length) {
    top3Revenue = buyerResult[0].values.reduce((sum: number, row: unknown[]) => sum + (row[1] as number), 0);
  }

  return {
    totalJobs: (totals[0] as number) || 0,
    completedJobs: (totals[1] as number) || 0,
    failedJobs: (totals[2] as number) || 0,
    expiredJobs: 0, // derived if we add expired event tracking
    totalRevenueUsd: (totals[3] as number) || 0,
    periodRevenueUsd: totalPeriodRevenue,
    periodJobs: (period[0] as number) || 0,
    uniqueBuyers: (period[2] as number) || 0,
    top3BuyerRevenuePct: totalPeriodRevenue > 0 ? top3Revenue / totalPeriodRevenue : 0,
  };
}

/**
 * Get daily revenue for an agent over the last N days.
 */
export async function getDailyRevenue(agentAddress: string, days: number = 7): Promise<number[]> {
  const database = await getDb();
  const results: number[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const result = database.exec(
      `SELECT COALESCE(SUM(amount_usd), 0) FROM job_events
       WHERE agent_address = ? AND event_type = 'completed'
       AND timestamp >= ? AND timestamp < ?`,
      [agentAddress, dateStr, nextDate],
    );

    results.push((result[0]?.values[0]?.[0] as number) || 0);
  }

  return results;
}

/**
 * Get daily job counts for an agent over the last N days.
 */
export async function getDailyJobs(agentAddress: string, days: number = 7): Promise<number[]> {
  const database = await getDb();
  const results: number[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const result = database.exec(
      `SELECT COUNT(*) FROM job_events
       WHERE agent_address = ? AND event_type = 'completed'
       AND timestamp >= ? AND timestamp < ?`,
      [agentAddress, dateStr, nextDate],
    );

    results.push((result[0]?.values[0]?.[0] as number) || 0);
  }

  return results;
}

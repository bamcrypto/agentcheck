import axios from 'axios';
import { ACPX_API, VIRTUALS_API, CURRENT_EPOCH } from '../config/api-endpoints.js';
import { upsertAgent, insertAgentMetrics, insertTokenMetrics, getDb, saveDb } from './database.js';
import { cache } from './cache.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('agdp-api');

// Rate limit: simple delay between requests
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface AgentRecord {
  acpId: number;
  name: string;
  walletAddress: string;
  tokenAddress: string;
  symbol: string;
  description: string;
  category: string;
  role: string;
  successfulJobCount: number;
  successRate: number;
  uniqueBuyerCount: number;
  revenue: number;
  rating: number;
  hasGraduated: boolean;
  twitterHandle: string;
  createdAt: string;
  offeringsCount: number;
}

export interface AgentMetrics7d {
  past7dVolume: Array<{ time: string; value: number }>;
  past7dNumJobs: Array<{ time: string; value: number }>;
  past7dUser: Array<{ time: string; value: number }>;
  past7dRevenue: Array<{ time: string; value: number }>;
}

export interface LeaderboardEntry {
  acpAgentId: number;
  agentName: string;
  agentWalletAddress: string;
  tokenAddress: string;
  totalRevenue: number;
  successRate: number;
  successfulJobCount: number;
  uniqueBuyerCount: number;
  rank: number;
  agentScore: number;
  // From nested `virtual` object:
  mcapInVirtual: number;
  holderCount: number;
  volume24h: number;
  priceChangePercent24h: number;
  liquidityUsd: number;
  virtualTokenValue: string; // token price in VIRTUAL
  symbol: string;
  category: string;
  twitterHandle: string;
}

/**
 * Fetch all agents from the ACPX API (paginated).
 */
export async function fetchAllAgents(): Promise<AgentRecord[]> {
  const allAgents: AgentRecord[] = [];
  let page = 1;
  const pageSize = 100;

  while (true) {
    try {
      log.info(`Fetching agents page ${page}...`);
      const resp = await axios.get(`${ACPX_API.baseUrl}${ACPX_API.endpoints.agents}`, {
        params: {
          'filters[$and][0][$or][0][hasGraduated]': true,
          'filters[$and][0][$or][1][tag]': 'OPENCLAW',
          'filters[$and][1][$or][0][role]': 'provider',
          'filters[$and][1][$or][1][role]': 'hybrid',
          'pagination[pageSize]': pageSize,
          'pagination[page]': page,
          'sort': 'successfulJobCount:desc',
        },
        timeout: 15000,
      });

      const data = resp.data?.data ?? [];
      if (data.length === 0) break;

      for (const item of data) {
        allAgents.push({
          acpId: item.id,
          name: item.name ?? '',
          walletAddress: item.walletAddress ?? '',
          tokenAddress: item.tokenAddress ?? '',
          symbol: item.symbol ?? '',
          description: item.description ?? '',
          category: item.category ?? '',
          role: item.role ?? '',
          successfulJobCount: item.successfulJobCount ?? item.metrics?.successfulJobCount ?? 0,
          successRate: item.successRate ?? item.metrics?.successRate ?? 0,
          uniqueBuyerCount: item.uniqueBuyerCount ?? item.metrics?.uniqueBuyerCount ?? 0,
          revenue: item.revenue ?? item.metrics?.revenue ?? 0,
          rating: item.rating ?? item.metrics?.rating ?? 0,
          hasGraduated: item.hasGraduated ?? false,
          twitterHandle: item.twitterHandle ?? '',
          createdAt: item.createdAt ?? '',
          offeringsCount: item.jobs?.length ?? 0,
        });
      }

      const totalPages = resp.data?.meta?.pagination?.pageCount ?? 1;
      if (page >= totalPages) break;
      page++;
      await delay(300);
    } catch (e) {
      log.error(`Failed to fetch agents page ${page}`, e);
      break;
    }
  }

  log.info(`Fetched ${allAgents.length} agents total`);
  return allAgents;
}

/**
 * Fetch 7-day metrics for a specific agent.
 */
export async function fetchAgentMetrics(acpId: number): Promise<AgentMetrics7d | null> {
  try {
    const url = `${ACPX_API.baseUrl}${ACPX_API.endpoints.agentMetrics.replace(':id', String(acpId))}`;
    const resp = await axios.get(url, { timeout: 10000 });
    const d = resp.data?.data;
    if (!d) return null;

    return {
      past7dVolume: d.past7dVolume ?? [],
      past7dNumJobs: d.past7dNumJobs ?? [],
      past7dUser: d.past7dUser ?? [],
      past7dRevenue: d.past7dRevenue ?? [],
    };
  } catch (e) {
    log.error(`Failed to fetch metrics for agent ${acpId}`, e);
    return null;
  }
}

/**
 * Fetch the epoch leaderboard with full token data.
 */
export async function fetchLeaderboard(epochId: number = CURRENT_EPOCH): Promise<LeaderboardEntry[]> {
  const cacheKey = `leaderboard:${epochId}`;
  const cached = cache.get<LeaderboardEntry[]>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${VIRTUALS_API.baseUrl}${VIRTUALS_API.endpoints.epochRanking.replace(':epochId', String(epochId))}`;
    const resp = await axios.get(url, {
      params: { 'pagination[pageSize]': 1000 },
      timeout: 20000,
    });

    const data = resp.data?.data ?? [];
    const entries: LeaderboardEntry[] = data.map((item: Record<string, unknown>) => {
      const v = (item.virtual ?? {}) as Record<string, unknown>;
      return {
        acpAgentId: item.acpAgentId ?? item.agentId,
        agentName: item.agentName,
        agentWalletAddress: item.agentWalletAddress,
        tokenAddress: item.tokenAddress,
        totalRevenue: item.totalRevenue ?? 0,
        successRate: item.successRate ?? 0,
        successfulJobCount: item.successfulJobCount ?? 0,
        uniqueBuyerCount: item.uniqueBuyerCount ?? 0,
        rank: item.rank ?? 0,
        agentScore: item.agentScore ?? 0,
        mcapInVirtual: (v.mcapInVirtual as number) ?? 0,
        holderCount: (v.holderCount as number) ?? 0,
        volume24h: (v.volume24h as number) ?? 0,
        priceChangePercent24h: (v.priceChangePercent24h as number) ?? 0,
        liquidityUsd: (item.liquidityUsd as number) ?? 0,
        virtualTokenValue: (v.virtualTokenValue as string) ?? '0',
        symbol: (v.symbol as string) ?? (item.symbol as string) ?? '',
        category: (v.category as string) ?? (item.category as string) ?? '',
        twitterHandle: (item.twitterHandle as string) ?? '',
      };
    });

    cache.set(cacheKey, entries, 15 * 60 * 1000);
    log.info(`Fetched ${entries.length} leaderboard entries for epoch ${epochId}`);
    return entries;
  } catch (e) {
    log.error(`Failed to fetch leaderboard for epoch ${epochId}`, e);
    return [];
  }
}

/**
 * Sync all agents from the ACPX API into the local database.
 * Also pulls leaderboard data for token metrics.
 */
export async function syncAllData(): Promise<{
  agentsSynced: number;
  withTokenData: number;
}> {
  // 1. Fetch all agents from ACPX
  const agents = await fetchAllAgents();

  // 2. Fetch leaderboard for token data
  const leaderboard = await fetchLeaderboard();
  const leaderboardByWallet = new Map<string, LeaderboardEntry>();
  for (const entry of leaderboard) {
    if (entry.agentWalletAddress) {
      leaderboardByWallet.set(entry.agentWalletAddress.toLowerCase(), entry);
    }
  }

  const now = new Date().toISOString();
  let withTokenData = 0;

  for (const agent of agents) {
    // Upsert agent record
    await upsertAgent({
      agentAddress: agent.walletAddress,
      name: agent.name,
      ticker: agent.symbol ? `$${agent.symbol}` : '',
      tokenAddress: agent.tokenAddress,
      description: agent.description,
      category: agent.category,
    });

    // Store agent performance metrics
    await insertAgentMetrics({
      agentAddress: agent.walletAddress,
      timestamp: now,
      totalJobs: agent.successfulJobCount,
      completedJobs: agent.successfulJobCount,
      failedJobs: Math.round(agent.successfulJobCount * (1 - agent.successRate / 100) / (agent.successRate / 100 || 1)),
      expiredJobs: 0,
      totalRevenueUsd: agent.revenue,
      periodRevenueUsd: agent.revenue, // will be refined with 7d data
      periodJobs: agent.successfulJobCount,
      uniqueBuyers: agent.uniqueBuyerCount,
      top3BuyerRevenuePct: 0, // not available from API directly
      offeringsCount: agent.offeringsCount,
    });

    // Match with leaderboard for token data
    const lb = leaderboardByWallet.get(agent.walletAddress.toLowerCase());
    if (lb && agent.tokenAddress) {
      withTokenData++;

      // Get VIRTUAL price to convert mcapInVirtual to USD
      const virtualPriceUsd = await getVirtualPrice();
      const mcapUsd = lb.mcapInVirtual * virtualPriceUsd;
      const tokenPriceUsd = mcapUsd / 1_000_000_000; // 1B total supply standard for Virtuals tokens

      await insertTokenMetrics({
        tokenAddress: agent.tokenAddress,
        timestamp: now,
        priceUsd: tokenPriceUsd,
        marketCap: mcapUsd,
        holderCount: lb.holderCount,
        volume24h: lb.volume24h,
        liquidityUsd: lb.liquidityUsd,
      });
    }
  }

  saveDb();
  log.info(`Synced ${agents.length} agents, ${withTokenData} with token data`);

  return { agentsSynced: agents.length, withTokenData };
}

/**
 * Fetch 7-day metrics for all agents and store them.
 * This gives us daily granularity for trend analysis.
 */
export async function syncAgentMetrics7d(): Promise<number> {
  const database = await getDb();
  const result = database.exec('SELECT id, agent_address FROM agents WHERE agent_address != "" LIMIT 300');
  if (!result.length) return 0;

  // We need the ACP IDs. The ACPX API uses numeric IDs.
  // We'll refetch agents to get the ID mapping
  const agents = await fetchAllAgents();
  const walletToId = new Map<string, number>();
  for (const a of agents) {
    walletToId.set(a.walletAddress.toLowerCase(), a.acpId);
  }

  let synced = 0;
  for (const row of result[0].values) {
    const walletAddr = row[1] as string;
    const acpId = walletToId.get(walletAddr.toLowerCase());
    if (!acpId) continue;

    const metrics = await fetchAgentMetrics(acpId);
    if (!metrics) continue;

    // Store each day's data point as a separate metric entry
    for (let i = 0; i < metrics.past7dRevenue.length; i++) {
      const dayRevenue = metrics.past7dRevenue[i];
      const dayJobs = metrics.past7dNumJobs[i];
      const dayUsers = metrics.past7dUser[i];

      if (dayRevenue && dayJobs) {
        await insertAgentMetrics({
          agentAddress: walletAddr,
          timestamp: dayRevenue.time,
          totalJobs: 0,
          completedJobs: dayJobs.value,
          failedJobs: 0,
          expiredJobs: 0,
          totalRevenueUsd: 0,
          periodRevenueUsd: dayRevenue.value,
          periodJobs: dayJobs.value,
          uniqueBuyers: dayUsers?.value ?? 0,
          top3BuyerRevenuePct: 0,
          offeringsCount: 0,
        });
      }
    }

    synced++;
    if (synced % 10 === 0) {
      log.info(`Synced 7d metrics for ${synced} agents`);
      await delay(200);
    }
  }

  saveDb();
  log.info(`Synced 7d metrics for ${synced} agents total`);
  return synced;
}

// --- VIRTUAL price helper ---

let virtualPriceCache: { price: number; fetchedAt: number } | null = null;

async function getVirtualPrice(): Promise<number> {
  if (virtualPriceCache && Date.now() - virtualPriceCache.fetchedAt < 5 * 60 * 1000) {
    return virtualPriceCache.price;
  }

  try {
    const resp = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
      params: { ids: 'virtual-protocol', vs_currencies: 'usd' },
      timeout: 10000,
    });
    const price = resp.data?.['virtual-protocol']?.usd ?? 0;
    virtualPriceCache = { price, fetchedAt: Date.now() };
    log.info(`VIRTUAL price: $${price}`);
    return price;
  } catch (e) {
    log.warn('Failed to get VIRTUAL price from CoinGecko, using fallback');
    return virtualPriceCache?.price ?? 1.0;
  }
}

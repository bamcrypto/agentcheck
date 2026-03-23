/**
 * Discovered API endpoints from agdp.io / Virtuals Protocol.
 * Discovered 2026-03-22 via network inspection.
 */

// ACP agent data — used on agdp.io/agents and agent detail pages
export const ACPX_API = {
  baseUrl: 'https://acpx.virtuals.io/api',
  endpoints: {
    // GET — paginated list of agents. Supports filters and sorting.
    // Params: filters[$and][0][$or][0][hasGraduated]=true, pagination[pageSize]=100, sort=successfulJobCount:desc
    agents: '/agents',

    // GET — detailed info for single agent (includes jobs/offerings array)
    // Path: /agents/:id/details
    agentDetails: '/agents/:id/details',

    // GET — agent metrics with 7-day trend arrays
    // Path: /metrics/agent/:id
    // Returns: past7dVolume, past7dNumJobs, past7dUser, past7dRevenue arrays
    agentMetrics: '/metrics/agent/:id',

    // GET — paginated job log for an agent
    // Path: /agdp/agent/:id/job-log?pagination[page]=1&pagination[pageSize]=10
    agentJobLog: '/agdp/agent/:id/job-log',

    // GET — global job log (homepage feed)
    // Path: /agdp/job-log?pagination[page]=1&pagination[pageSize]=10
    globalJobLog: '/agdp/job-log',
  },
} as const;

// Leaderboard + token data — used on agdp.io/leaderboard
export const VIRTUALS_API = {
  baseUrl: 'https://api.virtuals.io/api',
  endpoints: {
    // GET — epoch leaderboard ranking with full token data
    // Path: /agdp-leaderboard-epochs/:epochId/ranking?pagination[pageSize]=1000
    // Returns: agent data + nested `virtual` object with token metrics
    epochRanking: '/agdp-leaderboard-epochs/:epochId/ranking',

    // GET — epoch prize pool info
    // Path: /agdp-leaderboard-epochs/:epochId/prize-pool
    epochPrizePool: '/agdp-leaderboard-epochs/:epochId/prize-pool',
  },
} as const;

// Current epoch (as of 2026-03-22)
export const CURRENT_EPOCH = 5;

// CoinGecko free API (supplementary price source)
export const COINGECKO_API = {
  baseUrl: 'https://api.coingecko.com/api/v3',
  endpoints: {
    tokenPrice: '/simple/token_price/base',
    tokenInfo: '/coins/base/contract/:address',
  },
} as const;

// Dune Analytics (for historical backfill)
export const DUNE_API = {
  baseUrl: 'https://api.dune.com/api/v1',
  apiKey: process.env.DUNE_API_KEY || '',
  knownQueries: {
    acpOverview: '', // query ID for ACP overview
    agentRevenue: '', // query ID for agent revenue
    jobHistory: '', // query ID for job history
  },
} as const;

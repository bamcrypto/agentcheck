import axios from 'axios';
import { COINGECKO_API } from '../../config/api-endpoints.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('coingecko');

// Rate limiting: CoinGecko free tier allows ~10-30 calls/min
let lastCoinGeckoCall = 0;
const MIN_INTERVAL_MS = 2000; // 2 seconds between calls

async function rateLimitedGet(url: string, params?: Record<string, unknown>, timeout = 8000) {
  const now = Date.now();
  const wait = Math.max(0, MIN_INTERVAL_MS - (now - lastCoinGeckoCall));
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastCoinGeckoCall = Date.now();
  return axios.get(url, { params, timeout });
}

export interface CoinGeckoTokenResult {
  available: boolean;
  name: string;
  symbol: string;
  price_usd: number;
  market_cap: number;
  total_volume_24h: number;
  price_change_24h_pct: number;
  price_change_7d_pct: number;
  ath: number;
  ath_change_pct: number;
  atl: number;
  total_supply: number;
  circulating_supply: number;
  coingecko_score: number;
  developer_score: number;
  community_score: number;
  liquidity_score: number;
}

export interface CoinGeckoPriceHistory {
  available: boolean;
  prices: [number, number][]; // [timestamp, price]
}

const EMPTY_TOKEN: CoinGeckoTokenResult = {
  available: false,
  name: '',
  symbol: '',
  price_usd: 0,
  market_cap: 0,
  total_volume_24h: 0,
  price_change_24h_pct: 0,
  price_change_7d_pct: 0,
  ath: 0,
  ath_change_pct: 0,
  atl: 0,
  total_supply: 0,
  circulating_supply: 0,
  coingecko_score: 0,
  developer_score: 0,
  community_score: 0,
  liquidity_score: 0,
};

/**
 * Get token info from CoinGecko by contract address.
 */
export async function getTokenInfo(
  address: string,
  chain: string = 'base',
): Promise<CoinGeckoTokenResult> {
  const platform = chain === 'base' ? 'base' : chain === 'ethereum' ? 'ethereum' : chain;
  const url = `${COINGECKO_API.baseUrl}/coins/${platform}/contract/${address.toLowerCase()}`;

  try {
    const resp = await rateLimitedGet(url);
    const d = resp.data;
    if (!d) return { ...EMPTY_TOKEN, available: false };

    const md = d.market_data ?? {};

    return {
      available: true,
      name: d.name ?? '',
      symbol: (d.symbol ?? '').toUpperCase(),
      price_usd: md.current_price?.usd ?? 0,
      market_cap: md.market_cap?.usd ?? 0,
      total_volume_24h: md.total_volume?.usd ?? 0,
      price_change_24h_pct: md.price_change_percentage_24h ?? 0,
      price_change_7d_pct: md.price_change_percentage_7d ?? 0,
      ath: md.ath?.usd ?? 0,
      ath_change_pct: md.ath_change_percentage?.usd ?? 0,
      atl: md.atl?.usd ?? 0,
      total_supply: md.total_supply ?? 0,
      circulating_supply: md.circulating_supply ?? 0,
      coingecko_score: d.coingecko_score ?? 0,
      developer_score: d.developer_score ?? 0,
      community_score: d.community_score ?? 0,
      liquidity_score: d.liquidity_score ?? 0,
    };
  } catch (e: unknown) {
    log.warn(`CoinGecko token info unavailable for ${address}: ${(e as Error)?.message}`);
    return { ...EMPTY_TOKEN, available: false };
  }
}

/**
 * Get price history for technical analysis.
 * Returns hourly data for the last 14 days.
 */
export async function getPriceHistory(
  address: string,
  chain: string = 'base',
  days: number = 14,
): Promise<CoinGeckoPriceHistory> {
  const platform = chain === 'base' ? 'base' : chain === 'ethereum' ? 'ethereum' : chain;
  const url = `${COINGECKO_API.baseUrl}/coins/${platform}/contract/${address.toLowerCase()}/market_chart`;

  try {
    const resp = await rateLimitedGet(url, { vs_currency: 'usd', days }, 10000);

    const prices = resp.data?.prices;
    if (!Array.isArray(prices) || prices.length === 0) {
      return { available: false, prices: [] };
    }

    return { available: true, prices };
  } catch (e: unknown) {
    log.warn(`CoinGecko price history unavailable for ${address}: ${(e as Error)?.message}`);
    return { available: false, prices: [] };
  }
}

// Well-known tokens on Base — instant resolution without API calls
const KNOWN_TOKENS: Record<string, string> = {
  usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  weth: '0x4200000000000000000000000000000000000006',
  dai: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
  usdbc: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
  virtual: '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b',
  cbbtc: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
  aero: '0x940181a94A35A4569E4529A3CDfB74e38FD98631',
  degen: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed',
  brett: '0x532f27101965dd16442E59d40670FaF5eBB142E4',
  toshi: '0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4',
};

/**
 * Resolve a token symbol/name to a contract address on Base.
 * Checks known tokens first, then CoinGecko, then DexScreener.
 */
export async function resolveTokenAddress(
  query: string,
  chain: string = 'base',
): Promise<string | null> {
  // If it already looks like an address, return it
  if (/^0x[a-fA-F0-9]{40}$/.test(query)) return query;

  const normalized = query.toLowerCase().replace(/^\$/, '').trim();

  // Check known tokens first
  if (KNOWN_TOKENS[normalized]) return KNOWN_TOKENS[normalized];

  // Try CoinGecko search
  try {
    const resp = await rateLimitedGet(`${COINGECKO_API.baseUrl}/search`, { query: normalized }, 5000);

    const coins = resp.data?.coins ?? [];
    for (const coin of coins.slice(0, 10)) {
      if (coin.platforms?.[chain]) {
        return coin.platforms[chain];
      }
    }

    if (coins.length > 0 && coins[0].platforms) {
      const platforms = coins[0].platforms;
      return platforms[chain] ?? platforms.base ?? null;
    }
  } catch {
    // Fall through to DexScreener
  }

  // Fallback: DexScreener search
  try {
    const resp = await axios.get(`https://api.dexscreener.com/latest/dex/search`, {
      params: { q: normalized },
      timeout: 5000,
    });

    const pairs = resp.data?.pairs ?? [];
    // Find pair on the right chain
    const chainSlug = chain === 'base' ? 'base' : chain;
    for (const pair of pairs.slice(0, 20)) {
      if (pair.chainId === chainSlug && pair.baseToken?.address) {
        return pair.baseToken.address;
      }
    }
  } catch {
    // Give up
  }

  return null;
}

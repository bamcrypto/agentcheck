import axios from 'axios';
import { DEXSCREENER_API } from '../../config/api-endpoints.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('dexscreener');

export interface DexScreenerResult {
  available: boolean;
  pairs: DexPair[];
  primary_pair: DexPair | null;
  total_liquidity_usd: number;
  total_volume_24h: number;
  price_usd: number;
  market_cap: number;
  price_change_5m: number;
  price_change_1h: number;
  price_change_6h: number;
  price_change_24h: number;
  token_age_hours: number;
  pair_count: number;
  txns_24h_buys: number;
  txns_24h_sells: number;
  buy_sell_ratio: number;
  flags: string[];
}

export interface DexPair {
  dex: string;
  pair_address: string;
  base_token: string;
  quote_token: string;
  liquidity_usd: number;
  volume_24h: number;
  price_usd: number;
  price_change_24h: number;
  created_at: string;
}

const EMPTY_RESULT: DexScreenerResult = {
  available: false,
  pairs: [],
  primary_pair: null,
  total_liquidity_usd: 0,
  total_volume_24h: 0,
  price_usd: 0,
  market_cap: 0,
  price_change_5m: 0,
  price_change_1h: 0,
  price_change_6h: 0,
  price_change_24h: 0,
  token_age_hours: 0,
  pair_count: 0,
  txns_24h_buys: 0,
  txns_24h_sells: 0,
  buy_sell_ratio: 0,
  flags: [],
};

const CHAIN_MAP: Record<string, string> = {
  base: 'base',
  ethereum: 'ethereum',
  bsc: 'bsc',
  arbitrum: 'arbitrum',
  polygon: 'polygon',
};

export async function getTokenData(
  address: string,
  chain: string = 'base',
): Promise<DexScreenerResult> {
  const chainSlug = CHAIN_MAP[chain] ?? 'base';
  const url = `${DEXSCREENER_API.baseUrl}/token-pairs/v1/${chainSlug}/${address}`;

  try {
    const resp = await axios.get(url, { timeout: 5000 });
    const pairs = resp.data ?? [];

    if (!Array.isArray(pairs) || pairs.length === 0) {
      log.warn(`No DexScreener pairs for ${address} on ${chain}`);
      return { ...EMPTY_RESULT, available: false };
    }

    // Parse pairs
    const parsedPairs: DexPair[] = pairs.map((p: Record<string, unknown>) => ({
      dex: (p.dexId as string) ?? '',
      pair_address: (p.pairAddress as string) ?? '',
      base_token: ((p.baseToken as Record<string, unknown>)?.symbol as string) ?? '',
      quote_token: ((p.quoteToken as Record<string, unknown>)?.symbol as string) ?? '',
      liquidity_usd: (p.liquidity as Record<string, unknown>)?.usd as number ?? 0,
      volume_24h: ((p.volume as Record<string, unknown>)?.h24 as number) ?? 0,
      price_usd: parseFloat((p.priceUsd as string) ?? '0'),
      price_change_24h: ((p.priceChange as Record<string, unknown>)?.h24 as number) ?? 0,
      created_at: (p.pairCreatedAt as string) ?? '',
    }));

    // Primary pair = highest liquidity
    const primary = parsedPairs.reduce((best, p) =>
      p.liquidity_usd > (best?.liquidity_usd ?? 0) ? p : best,
    parsedPairs[0]);

    // Aggregate
    const totalLiquidity = parsedPairs.reduce((s, p) => s + p.liquidity_usd, 0);
    const totalVolume = parsedPairs.reduce((s, p) => s + p.volume_24h, 0);

    // Price changes from primary pair data
    const priceData = pairs[0]?.priceChange as Record<string, number> | undefined;
    const txns = pairs[0]?.txns as Record<string, Record<string, number>> | undefined;
    const buys = txns?.h24?.buys ?? 0;
    const sells = txns?.h24?.sells ?? 0;

    // Token age
    const createdAt = pairs[0]?.pairCreatedAt;
    const ageMs = createdAt ? Date.now() - new Date(createdAt).getTime() : 0;
    const ageHours = ageMs > 0 ? ageMs / (1000 * 60 * 60) : 0;

    // Flags
    const flags: string[] = [];
    if (totalLiquidity < 1000) flags.push('extremely_low_liquidity');
    else if (totalLiquidity < 10000) flags.push('low_liquidity');
    if (ageHours < 24) flags.push('new_token_under_24h');
    if (totalVolume > 0 && totalLiquidity > 0 && totalVolume / totalLiquidity > 5) {
      flags.push('suspicious_volume_ratio');
    }
    if (sells > 0 && buys / sells < 0.3) flags.push('heavy_selling');
    if (parsedPairs.length === 1) flags.push('single_pair');
    const pc24 = priceData?.h24 ?? 0;
    if (pc24 < -50) flags.push('price_crashed_24h');
    if (pc24 > 200) flags.push('extreme_pump_24h');

    const marketCap = (pairs[0]?.marketCap as number) ?? (pairs[0]?.fdv as number) ?? 0;

    return {
      available: true,
      pairs: parsedPairs,
      primary_pair: primary,
      total_liquidity_usd: totalLiquidity,
      total_volume_24h: totalVolume,
      price_usd: primary.price_usd,
      market_cap: marketCap,
      price_change_5m: priceData?.m5 ?? 0,
      price_change_1h: priceData?.h1 ?? 0,
      price_change_6h: priceData?.h6 ?? 0,
      price_change_24h: pc24,
      token_age_hours: Math.round(ageHours),
      pair_count: parsedPairs.length,
      txns_24h_buys: buys,
      txns_24h_sells: sells,
      buy_sell_ratio: sells > 0 ? Math.round((buys / sells) * 100) / 100 : 0,
      flags,
    };
  } catch (e: unknown) {
    log.error(`DexScreener API error for ${address}:`, e);
    return { ...EMPTY_RESULT, available: false };
  }
}

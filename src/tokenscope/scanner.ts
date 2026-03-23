import { checkTokenSecurity } from './data-sources/goplus.js';
import { getTokenData } from './data-sources/dexscreener.js';
import { getContractInfo } from './data-sources/basescan.js';
import { getTokenInfo, getPriceHistory, resolveTokenAddress } from './data-sources/coingecko.js';
import { computeOverallRisk, type RiskScore } from './scoring.js';
import { computeTA, type TAResult } from './technical-analysis.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('scanner');

export type ScanDepth = 'quick' | 'standard' | 'technical' | 'full';

export interface ScanResult {
  token_address: string;
  chain: string;
  timestamp: string;
  scan_depth: ScanDepth;
  scan_time_ms: number;
  sources_available: string[];
  sources_failed: string[];

  // Risk assessment (always present)
  risk: RiskScore;

  // Token info (standard+)
  token?: {
    name: string;
    symbol: string;
    price_usd: number;
    market_cap: number;
    volume_24h: number;
    price_change_5m: number;
    price_change_1h: number;
    price_change_6h: number;
    price_change_24h: number;
    token_age_hours: number;
    holder_count: number;
    pair_count: number;
    total_liquidity_usd: number;
    buy_sell_ratio: number;
  };

  // Contract details (standard+)
  contract?: {
    is_verified: boolean;
    is_open_source: boolean;
    is_honeypot: boolean;
    has_mint_function: boolean;
    is_proxy: boolean;
    buy_tax: number;
    sell_tax: number;
    deployer_address: string;
    deployer_contract_count: number;
    deployer_age_days: number;
    flags: string[];
  };

  // Technical analysis (technical/full only)
  technical?: TAResult;

  // Summary verdict
  verdict: string;
}

/**
 * Main scan function — orchestrates all data sources in parallel.
 */
export async function scanToken(
  tokenInput: string,
  chain: string = 'base',
  depth: ScanDepth = 'standard',
): Promise<ScanResult> {
  const startTime = Date.now();

  // Step 1: Resolve token address
  let address = tokenInput.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    log.info(`Resolving "${tokenInput}" to address...`);
    const resolved = await resolveTokenAddress(tokenInput, chain);
    if (!resolved) {
      return makeErrorResult(tokenInput, chain, depth, startTime,
        `Could not resolve "${tokenInput}" to a token address. Try providing the contract address directly.`);
    }
    address = resolved;
    log.info(`Resolved to ${address}`);
  }

  // Step 2: Fetch all data sources in parallel
  const sourcesAvailable: string[] = [];
  const sourcesFailed: string[] = [];

  // Always fetch: GoPlus + DexScreener (core risk data)
  // Standard+: Basescan (deployer info)
  // Technical/Full: CoinGecko price history
  const fetchPromises: Record<string, Promise<unknown>> = {
    goplus: checkTokenSecurity(address, chain),
    dexscreener: getTokenData(address, chain),
  };

  if (depth !== 'quick') {
    fetchPromises.basescan = getContractInfo(address);
    fetchPromises.coingecko = getTokenInfo(address, chain);
  }

  if (depth === 'technical' || depth === 'full') {
    fetchPromises.priceHistory = getPriceHistory(address, chain, 14);
  }

  // Execute all in parallel with individual error handling
  const results = await Promise.allSettled(
    Object.entries(fetchPromises).map(async ([key, promise]) => {
      try {
        const result = await promise;
        return { key, result, ok: true };
      } catch (e) {
        return { key, result: null, ok: false, error: e };
      }
    }),
  );

  // Extract results
  type SourceResult = { key: string; result: unknown; ok: boolean };
  const data: Record<string, unknown> = {};
  for (const r of results) {
    if (r.status === 'fulfilled') {
      const { key, result, ok } = r.value as SourceResult;
      data[key] = result;
      if (ok && (result as Record<string, unknown>)?.available !== false) {
        sourcesAvailable.push(key);
      } else {
        sourcesFailed.push(key);
      }
    }
  }

  const goplus = data.goplus as Awaited<ReturnType<typeof checkTokenSecurity>>;
  const dex = data.dexscreener as Awaited<ReturnType<typeof getTokenData>>;
  const basescan = (data.basescan as Awaited<ReturnType<typeof getContractInfo>>) ?? {
    available: false, is_verified: false, contract_name: '', compiler_version: '',
    deployer_address: '', deploy_tx_hash: '', deployer_contract_count: 0, deployer_age_days: 0, flags: [],
  };
  const cgToken = data.coingecko as Awaited<ReturnType<typeof getTokenInfo>> | undefined;
  const priceHistory = data.priceHistory as Awaited<ReturnType<typeof getPriceHistory>> | undefined;

  // Step 3: Compute risk score
  const risk = computeOverallRisk(goplus, dex, basescan);

  // Step 4: Build result
  const scanTimeMs = Date.now() - startTime;

  const result: ScanResult = {
    token_address: address,
    chain,
    timestamp: new Date().toISOString(),
    scan_depth: depth,
    scan_time_ms: scanTimeMs,
    sources_available: sourcesAvailable,
    sources_failed: sourcesFailed,
    risk,
    verdict: generateVerdict(risk, dex, goplus, address),
  };

  // Token info (standard+)
  if (depth !== 'quick') {
    result.token = {
      name: cgToken?.name ?? dex.pairs?.[0]?.base_token ?? '',
      symbol: cgToken?.symbol ?? dex.pairs?.[0]?.base_token ?? '',
      price_usd: dex.price_usd || cgToken?.price_usd || 0,
      market_cap: dex.market_cap || cgToken?.market_cap || 0,
      volume_24h: dex.total_volume_24h || cgToken?.total_volume_24h || 0,
      price_change_5m: dex.price_change_5m,
      price_change_1h: dex.price_change_1h,
      price_change_6h: dex.price_change_6h,
      price_change_24h: dex.price_change_24h || cgToken?.price_change_24h_pct || 0,
      token_age_hours: dex.token_age_hours,
      holder_count: goplus.holder_count,
      pair_count: dex.pair_count,
      total_liquidity_usd: dex.total_liquidity_usd,
      buy_sell_ratio: dex.buy_sell_ratio,
    };
  }

  // Contract details (standard+)
  if (depth !== 'quick') {
    result.contract = {
      is_verified: basescan.is_verified || goplus.is_open_source,
      is_open_source: goplus.is_open_source,
      is_honeypot: goplus.is_honeypot,
      has_mint_function: goplus.has_mint_function,
      is_proxy: goplus.is_proxy,
      buy_tax: goplus.buy_tax,
      sell_tax: goplus.sell_tax,
      deployer_address: basescan.deployer_address || goplus.creator_address,
      deployer_contract_count: basescan.deployer_contract_count,
      deployer_age_days: basescan.deployer_age_days,
      flags: [...new Set([...goplus.flags, ...basescan.flags])],
    };
  }

  // Technical analysis (technical/full)
  if ((depth === 'technical' || depth === 'full') && priceHistory?.available) {
    result.technical = computeTA(priceHistory.prices);
  }

  log.info(`Scan complete: ${address} → ${risk.level} (${risk.overall}/100) in ${scanTimeMs}ms [${sourcesAvailable.length}/${sourcesAvailable.length + sourcesFailed.length} sources]`);

  return result;
}

function generateVerdict(
  risk: RiskScore,
  dex: Awaited<ReturnType<typeof getTokenData>>,
  goplus: Awaited<ReturnType<typeof checkTokenSecurity>>,
  address: string,
): string {
  const parts: string[] = [];

  if (risk.critical_flags.length > 0) {
    parts.push(`⛔ CRITICAL: ${risk.critical_flags.join(', ')} detected.`);
    parts.push('Do not interact with this token.');
    return parts.join(' ');
  }

  parts.push(`Risk level: ${risk.level} (${risk.overall}/100).`);

  // Contract summary
  if (goplus.available) {
    if (goplus.is_open_source && !goplus.is_proxy && !goplus.has_mint_function) {
      parts.push('Contract is clean and verified.');
    } else {
      const issues = goplus.flags.slice(0, 3).join(', ');
      if (issues) parts.push(`Contract flags: ${issues}.`);
    }
  }

  // Liquidity summary
  if (dex.available) {
    if (dex.total_liquidity_usd > 100000) {
      parts.push(`Strong liquidity ($${(dex.total_liquidity_usd / 1000).toFixed(0)}K).`);
    } else if (dex.total_liquidity_usd > 10000) {
      parts.push(`Moderate liquidity ($${(dex.total_liquidity_usd / 1000).toFixed(1)}K).`);
    } else {
      parts.push(`Low liquidity ($${dex.total_liquidity_usd.toFixed(0)}).`);
    }
  }

  parts.push(risk.recommendation);

  return parts.join(' ');
}

function makeErrorResult(
  tokenInput: string,
  chain: string,
  depth: ScanDepth,
  startTime: number,
  error: string,
): ScanResult {
  return {
    token_address: tokenInput,
    chain,
    timestamp: new Date().toISOString(),
    scan_depth: depth,
    scan_time_ms: Date.now() - startTime,
    sources_available: [],
    sources_failed: ['all'],
    risk: {
      overall: -1,
      level: 'AVOID',
      recommendation: error,
      dimensions: {
        contract_security: { score: -1, weight: 40, details: [] },
        liquidity: { score: -1, weight: 20, details: [] },
        holder_concentration: { score: -1, weight: 15, details: [] },
        deployer_reputation: { score: -1, weight: 15, details: [] },
        market_signals: { score: -1, weight: 10, details: [] },
      },
      critical_flags: [],
    },
    verdict: error,
  };
}

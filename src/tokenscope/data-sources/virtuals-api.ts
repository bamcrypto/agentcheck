import axios from 'axios';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('virtuals-api');

export interface VirtualsTokenResult {
  available: boolean;
  name: string;
  symbol: string;
  price_usd: number;
  market_cap: number;
  volume_24h: number;
  holder_count: number;
  total_value_locked: number;
  is_graduated: boolean;
}

const EMPTY: VirtualsTokenResult = {
  available: false,
  name: '',
  symbol: '',
  price_usd: 0,
  market_cap: 0,
  volume_24h: 0,
  holder_count: 0,
  total_value_locked: 0,
  is_graduated: false,
};

/**
 * Try to get token data from the Virtuals Protocol API.
 * Useful for agent tokens that trade on the bonding curve (not on DEXes).
 */
export async function getVirtualsTokenData(address: string): Promise<VirtualsTokenResult> {
  try {
    // Search for the token on Virtuals
    const resp = await axios.get('https://api.virtuals.io/api/virtuals', {
      params: {
        'filters[tokenAddress][$eqi]': address,
        'pagination[pageSize]': 1,
      },
      timeout: 5000,
    });

    const data = resp.data?.data?.[0];
    if (!data) return { ...EMPTY };

    // Compute price from virtualTokenValue and estimated VIRTUAL price (~$0.66)
    const virtualPrice = 0.66; // approximate, could be fetched dynamically
    const tokenValueInVirtual = parseFloat(data.virtualTokenValue ?? '0') / 1e18;
    const priceUsd = tokenValueInVirtual * virtualPrice;
    const fdvInVirtual = data.fdvInVirtual ?? 0;
    const marketCap = fdvInVirtual * virtualPrice;

    return {
      available: true,
      name: data.name ?? '',
      symbol: data.symbol ?? '',
      price_usd: priceUsd,
      market_cap: marketCap,
      volume_24h: data.volume24h ?? data.netVolume24h ?? 0,
      holder_count: data.holderCount ?? 0,
      total_value_locked: data.liquidityUsd ?? data.totalValueLocked ?? 0,
      is_graduated: data.status === 'AVAILABLE' || data.hasGraduated === true,
    };
  } catch (e) {
    log.warn(`Virtuals API unavailable for ${address}: ${(e as Error)?.message}`);
    return { ...EMPTY };
  }
}

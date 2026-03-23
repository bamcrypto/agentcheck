import axios from 'axios';
import { GOPLUS_API } from '../../config/api-endpoints.js';
import { createLogger } from '../../utils/logger.js';

const log = createLogger('goplus');

export interface GoPlusResult {
  available: boolean;
  is_honeypot: boolean;
  is_open_source: boolean;
  is_proxy: boolean;
  has_mint_function: boolean;
  can_self_destruct: boolean;
  owner_can_change_balance: boolean;
  has_blacklist: boolean;
  has_whitelist: boolean;
  has_trading_cooldown: boolean;
  can_pause_trading: boolean;
  hidden_owner: boolean;
  can_take_back_ownership: boolean;
  external_calls: boolean;
  is_anti_whale: boolean;
  buy_tax: number;
  sell_tax: number;
  holder_count: number;
  top_holders: { address: string; percent: number; is_locked: boolean }[];
  lp_holders: { address: string; percent: number; is_locked: boolean }[];
  is_true_token: boolean;
  is_airdrop_scam: boolean;
  owner_address: string;
  creator_address: string;
  flags: string[];
}

const EMPTY_RESULT: GoPlusResult = {
  available: false,
  is_honeypot: false,
  is_open_source: false,
  is_proxy: false,
  has_mint_function: false,
  can_self_destruct: false,
  owner_can_change_balance: false,
  has_blacklist: false,
  has_whitelist: false,
  has_trading_cooldown: false,
  can_pause_trading: false,
  hidden_owner: false,
  can_take_back_ownership: false,
  external_calls: false,
  is_anti_whale: false,
  buy_tax: 0,
  sell_tax: 0,
  holder_count: 0,
  top_holders: [],
  lp_holders: [],
  is_true_token: true,
  is_airdrop_scam: false,
  owner_address: '',
  creator_address: '',
  flags: [],
};

function toBool(val: unknown): boolean {
  return val === '1' || val === 1 || val === true;
}

function toNumber(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

export async function checkTokenSecurity(
  address: string,
  chain: string = 'base',
): Promise<GoPlusResult> {
  const chainId = GOPLUS_API.chainIds[chain as keyof typeof GOPLUS_API.chainIds] ?? '8453';
  const url = `${GOPLUS_API.baseUrl}/token_security/${chainId}`;

  try {
    const resp = await axios.get(url, {
      params: { contract_addresses: address.toLowerCase() },
      timeout: 5000,
    });

    const data = resp.data?.result?.[address.toLowerCase()];
    if (!data) {
      log.warn(`No GoPlus data for ${address} on chain ${chain}`);
      return { ...EMPTY_RESULT, available: false };
    }

    const flags: string[] = [];
    if (toBool(data.is_honeypot)) flags.push('honeypot');
    if (toBool(data.is_mintable)) flags.push('mintable');
    if (toBool(data.is_proxy)) flags.push('proxy_contract');
    if (toBool(data.can_take_back_ownership)) flags.push('can_reclaim_ownership');
    if (toBool(data.owner_change_balance)) flags.push('owner_can_change_balance');
    if (toBool(data.selfdestruct)) flags.push('self_destruct');
    if (toBool(data.hidden_owner)) flags.push('hidden_owner');
    if (toBool(data.external_call)) flags.push('external_calls');
    if (toBool(data.cannot_sell_all)) flags.push('cannot_sell_all');
    if (!toBool(data.is_open_source)) flags.push('not_open_source');
    if (toBool(data.is_airdrop_scam)) flags.push('airdrop_scam');
    if (toBool(data.is_true_token) === false) flags.push('fake_token');

    const buyTax = toNumber(data.buy_tax) * 100;
    const sellTax = toNumber(data.sell_tax) * 100;
    if (buyTax > 5) flags.push(`buy_tax_${buyTax.toFixed(1)}%`);
    if (sellTax > 5) flags.push(`sell_tax_${sellTax.toFixed(1)}%`);

    // Parse holders
    const topHolders = (data.holders ?? []).slice(0, 10).map((h: Record<string, unknown>) => ({
      address: (h.address as string) ?? '',
      percent: toNumber(h.percent) * 100,
      is_locked: toBool(h.is_locked),
    }));

    const lpHolders = (data.lp_holders ?? []).map((h: Record<string, unknown>) => ({
      address: (h.address as string) ?? '',
      percent: toNumber(h.percent) * 100,
      is_locked: toBool(h.is_locked),
    }));

    return {
      available: true,
      is_honeypot: toBool(data.is_honeypot),
      is_open_source: toBool(data.is_open_source),
      is_proxy: toBool(data.is_proxy),
      has_mint_function: toBool(data.is_mintable),
      can_self_destruct: toBool(data.selfdestruct),
      owner_can_change_balance: toBool(data.owner_change_balance),
      has_blacklist: toBool(data.is_blacklisted),
      has_whitelist: toBool(data.is_whitelisted),
      has_trading_cooldown: toBool(data.trading_cooldown),
      can_pause_trading: toBool(data.transfer_pausable),
      hidden_owner: toBool(data.hidden_owner),
      can_take_back_ownership: toBool(data.can_take_back_ownership),
      external_calls: toBool(data.external_call),
      is_anti_whale: toBool(data.is_anti_whale),
      buy_tax: buyTax,
      sell_tax: sellTax,
      holder_count: toNumber(data.holder_count),
      top_holders: topHolders,
      lp_holders: lpHolders,
      is_true_token: toBool(data.is_true_token) !== false,
      is_airdrop_scam: toBool(data.is_airdrop_scam),
      owner_address: (data.owner_address as string) ?? '',
      creator_address: (data.creator_address as string) ?? '',
      flags,
    };
  } catch (e: unknown) {
    log.error(`GoPlus API error for ${address}:`, e);
    return { ...EMPTY_RESULT, available: false };
  }
}

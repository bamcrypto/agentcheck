import type { GoPlusResult } from './data-sources/goplus.js';
import type { DexScreenerResult } from './data-sources/dexscreener.js';
import type { BasescanResult } from './data-sources/basescan.js';

export interface RiskScore {
  overall: number; // 0-100 (0=safest, 100=most dangerous)
  level: 'SAFE' | 'CAUTION' | 'DANGER' | 'AVOID';
  recommendation: string;
  dimensions: {
    contract_security: { score: number; weight: number; details: string[] };
    liquidity: { score: number; weight: number; details: string[] };
    holder_concentration: { score: number; weight: number; details: string[] };
    deployer_reputation: { score: number; weight: number; details: string[] };
    market_signals: { score: number; weight: number; details: string[] };
  };
  critical_flags: string[];
}

/**
 * Compute contract security score (0-100, higher = more risky).
 * Weight: 40%
 */
export function scoreContractSecurity(goplus: GoPlusResult): { score: number; details: string[] } {
  if (!goplus.available) return { score: 30, details: ['contract_data_unavailable'] };

  let score = 0;
  const details: string[] = [];

  // Instant AVOID triggers
  // Note: skip fake_token flag for tokens with many holders (>1000) — GoPlus false positives on stablecoins
  if (goplus.is_honeypot) { score = 100; details.push('HONEYPOT_DETECTED'); return { score, details }; }
  if (goplus.is_airdrop_scam) { score = 95; details.push('AIRDROP_SCAM'); return { score, details }; }
  if (!goplus.is_true_token && goplus.holder_count < 1000) { score = 95; details.push('FAKE_TOKEN'); return { score, details }; }

  // Additive risk factors
  if (!goplus.is_open_source) { score += 20; details.push('not_open_source'); }
  if (goplus.is_proxy) { score += 15; details.push('proxy_contract'); }
  if (goplus.has_mint_function) { score += 15; details.push('mintable'); }
  if (goplus.can_self_destruct) { score += 20; details.push('self_destruct'); }
  if (goplus.owner_can_change_balance) { score += 25; details.push('owner_can_change_balance'); }
  if (goplus.hidden_owner) { score += 15; details.push('hidden_owner'); }
  if (goplus.can_take_back_ownership) { score += 15; details.push('can_reclaim_ownership'); }
  if (goplus.can_pause_trading) { score += 10; details.push('can_pause_trading'); }
  if (goplus.has_blacklist) { score += 8; details.push('has_blacklist'); }
  if (goplus.external_calls) { score += 8; details.push('external_calls'); }

  // Tax analysis
  if (goplus.buy_tax > 10) { score += 20; details.push(`high_buy_tax_${goplus.buy_tax.toFixed(1)}%`); }
  else if (goplus.buy_tax > 5) { score += 10; details.push(`moderate_buy_tax_${goplus.buy_tax.toFixed(1)}%`); }

  if (goplus.sell_tax > 10) { score += 25; details.push(`high_sell_tax_${goplus.sell_tax.toFixed(1)}%`); }
  else if (goplus.sell_tax > 5) { score += 12; details.push(`moderate_sell_tax_${goplus.sell_tax.toFixed(1)}%`); }

  // Positive signals
  if (goplus.is_open_source && !goplus.is_proxy && !goplus.has_mint_function) {
    details.push('clean_contract');
  }

  return { score: Math.min(100, score), details };
}

/**
 * Compute liquidity score (0-100, higher = more risky).
 * Weight: 20%
 */
export function scoreLiquidity(dex: DexScreenerResult): { score: number; details: string[] } {
  if (!dex.available) return { score: 30, details: ['liquidity_data_unavailable'] };

  let score = 0;
  const details: string[] = [];

  // Liquidity depth
  const liq = dex.total_liquidity_usd;
  if (liq < 1000) { score += 45; details.push('extremely_low_liquidity'); }
  else if (liq < 10000) { score += 30; details.push('low_liquidity'); }
  else if (liq < 50000) { score += 15; details.push('moderate_liquidity'); }
  else if (liq < 100000) { score += 8; }
  else { details.push('strong_liquidity'); }

  // Volume/liquidity ratio (wash trading signal)
  if (liq > 0 && dex.total_volume_24h / liq > 10) {
    score += 25; details.push('suspicious_volume_ratio');
  } else if (liq > 0 && dex.total_volume_24h / liq > 5) {
    score += 15; details.push('elevated_volume_ratio');
  }

  // Token age
  if (dex.token_age_hours < 6) { score += 25; details.push('very_new_token'); }
  else if (dex.token_age_hours < 24) { score += 15; details.push('new_token'); }
  else if (dex.token_age_hours < 168) { score += 5; details.push('young_token'); }

  // Single pair dependency
  if (dex.pair_count === 1) { score += 8; details.push('single_trading_pair'); }

  return { score: Math.min(100, score), details };
}

/**
 * Compute holder concentration score (0-100, higher = more risky).
 * Weight: 15%
 */
export function scoreHolderConcentration(goplus: GoPlusResult): { score: number; details: string[] } {
  if (!goplus.available || goplus.top_holders.length === 0) {
    return { score: 30, details: ['holder_data_unavailable'] };
  }

  let score = 0;
  const details: string[] = [];

  // Top 10 holder concentration
  const top10Pct = goplus.top_holders.reduce((s, h) => s + h.percent, 0);
  if (top10Pct > 90) { score += 45; details.push(`top_10_hold_${top10Pct.toFixed(1)}%`); }
  else if (top10Pct > 70) { score += 30; details.push(`top_10_hold_${top10Pct.toFixed(1)}%`); }
  else if (top10Pct > 50) { score += 15; details.push(`top_10_hold_${top10Pct.toFixed(1)}%`); }
  else { details.push(`top_10_hold_${top10Pct.toFixed(1)}%`); }

  // Single holder dominance
  const topHolder = goplus.top_holders[0];
  if (topHolder && topHolder.percent > 50) {
    score += 30; details.push(`single_holder_${topHolder.percent.toFixed(1)}%`);
  } else if (topHolder && topHolder.percent > 30) {
    score += 15; details.push(`large_single_holder_${topHolder.percent.toFixed(1)}%`);
  }

  // Holder count
  if (goplus.holder_count < 50) { score += 15; details.push('very_few_holders'); }
  else if (goplus.holder_count < 200) { score += 8; details.push('low_holder_count'); }
  else if (goplus.holder_count > 5000) { details.push('well_distributed'); }

  // LP locked status
  const lpLocked = goplus.lp_holders.some(h => h.is_locked);
  if (!lpLocked && goplus.lp_holders.length > 0) {
    score += 10; details.push('lp_not_locked');
  } else if (lpLocked) {
    details.push('lp_locked');
  }

  return { score: Math.min(100, score), details };
}

/**
 * Compute deployer reputation score (0-100, higher = more risky).
 * Weight: 15%
 */
export function scoreDeployerReputation(basescan: BasescanResult): { score: number; details: string[] } {
  if (!basescan.available) return { score: 30, details: ['deployer_data_unavailable'] };

  let score = 0;
  const details: string[] = [];

  if (!basescan.is_verified) { score += 25; details.push('contract_not_verified'); }
  else { details.push('contract_verified'); }

  if (basescan.deployer_contract_count > 20) {
    score += 30; details.push('serial_deployer_high');
  } else if (basescan.deployer_contract_count > 10) {
    score += 15; details.push('serial_deployer');
  }

  if (basescan.deployer_age_days < 7) {
    score += 20; details.push('new_deployer_wallet');
  } else if (basescan.deployer_age_days < 30) {
    score += 10; details.push('recent_deployer_wallet');
  } else if (basescan.deployer_age_days > 365) {
    details.push('established_deployer');
  }

  return { score: Math.min(100, score), details };
}

/**
 * Compute market signals score (0-100, higher = more risky).
 * Weight: 10%
 */
export function scoreMarketSignals(dex: DexScreenerResult): { score: number; details: string[] } {
  if (!dex.available) return { score: 30, details: ['market_data_unavailable'] };

  let score = 0;
  const details: string[] = [];

  // Price crash
  if (dex.price_change_24h < -70) { score += 35; details.push('severe_crash_24h'); }
  else if (dex.price_change_24h < -50) { score += 25; details.push('major_decline_24h'); }
  else if (dex.price_change_24h < -30) { score += 15; details.push('significant_decline_24h'); }

  // Extreme pump (often precedes dump)
  if (dex.price_change_24h > 500) { score += 20; details.push('extreme_pump_24h'); }
  else if (dex.price_change_24h > 200) { score += 10; details.push('major_pump_24h'); }

  // Buy/sell ratio
  if (dex.buy_sell_ratio > 0 && dex.buy_sell_ratio < 0.3) {
    score += 20; details.push('heavy_selling_pressure');
  } else if (dex.buy_sell_ratio > 3) {
    score += 5; details.push('heavy_buying_fomo');
  }

  // Low volume (dead token)
  if (dex.total_volume_24h < 100 && dex.token_age_hours > 168) {
    score += 15; details.push('dead_volume');
  }

  return { score: Math.min(100, score), details };
}

/**
 * Compute the overall risk score from all dimensions.
 */
export function computeOverallRisk(
  goplus: GoPlusResult,
  dex: DexScreenerResult,
  basescan: BasescanResult,
): RiskScore {
  const contract = scoreContractSecurity(goplus);
  const liquidity = scoreLiquidity(dex);
  const holders = scoreHolderConcentration(goplus);
  const deployer = scoreDeployerReputation(basescan);
  const market = scoreMarketSignals(dex);

  const overall = Math.round(
    contract.score * 0.40 +
    liquidity.score * 0.20 +
    holders.score * 0.15 +
    deployer.score * 0.15 +
    market.score * 0.10,
  );

  // Determine level
  let level: RiskScore['level'];
  let recommendation: string;
  if (overall <= 25) {
    level = 'SAFE';
    recommendation = 'Low risk detected. Standard precautions apply.';
  } else if (overall <= 50) {
    level = 'CAUTION';
    recommendation = 'Moderate risk factors present. Proceed with smaller position sizes.';
  } else if (overall <= 75) {
    level = 'DANGER';
    recommendation = 'Significant risk factors detected. Only for high risk tolerance.';
  } else {
    level = 'AVOID';
    recommendation = 'Critical risk factors detected. Strongly advise against interaction.';
  }

  // Collect critical flags (instant-avoid triggers)
  const criticalFlags: string[] = [];
  if (goplus.is_honeypot) criticalFlags.push('HONEYPOT');
  if (goplus.is_airdrop_scam) criticalFlags.push('AIRDROP_SCAM');
  if (!goplus.is_true_token && goplus.available && goplus.holder_count < 1000) criticalFlags.push('FAKE_TOKEN');
  if (goplus.sell_tax > 50) criticalFlags.push('EXTREME_SELL_TAX');
  if (dex.total_liquidity_usd < 500 && dex.available) criticalFlags.push('NO_LIQUIDITY');

  if (criticalFlags.length > 0) {
    recommendation = `CRITICAL: ${criticalFlags.join(', ')} detected. Do not interact.`;
  }

  return {
    overall,
    level,
    recommendation,
    dimensions: {
      contract_security: { score: contract.score, weight: 40, details: contract.details },
      liquidity: { score: liquidity.score, weight: 20, details: liquidity.details },
      holder_concentration: { score: holders.score, weight: 15, details: holders.details },
      deployer_reputation: { score: deployer.score, weight: 15, details: deployer.details },
      market_signals: { score: market.score, weight: 10, details: market.details },
    },
    critical_flags: criticalFlags,
  };
}

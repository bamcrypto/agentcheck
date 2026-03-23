import axios from 'axios';
import { GOPLUS_API, BASESCAN_API } from '../config/api-endpoints.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('deployer-scanner');

export interface DeployerReport {
  token_address: string;
  deployer_address: string;
  chain: string;
  timestamp: string;
  scan_time_ms: number;
  sources_available: string[];
  sources_failed: string[];

  // Overall reputation
  risk_score: number; // 0-100
  risk_level: 'TRUSTED' | 'NEUTRAL' | 'SUSPICIOUS' | 'DANGEROUS';
  verdict: string;

  // GoPlus address security
  goplus_flags: {
    honeypot_related: boolean;
    malicious_contracts_created: number;
    phishing_activities: boolean;
    stealing_attack: boolean;
    money_laundering: boolean;
    sanctioned: boolean;
    mixer_usage: boolean;
    darkweb: boolean;
    cybercrime: boolean;
    blackmail: boolean;
    fake_kyc: boolean;
  };

  // Deployer profile
  profile: {
    wallet_age_days: number;
    total_contracts_deployed: number;
    is_verified_deployer: boolean;
    deployment_velocity_24h: number; // contracts in last 24h
  };

  // Flags
  critical_flags: string[];
  warning_flags: string[];
}

const EMPTY_GOPLUS_FLAGS = {
  honeypot_related: false,
  malicious_contracts_created: 0,
  phishing_activities: false,
  stealing_attack: false,
  money_laundering: false,
  sanctioned: false,
  mixer_usage: false,
  darkweb: false,
  cybercrime: false,
  blackmail: false,
  fake_kyc: false,
};

function toBool(val: unknown): boolean {
  return val === '1' || val === 1 || val === true;
}

/**
 * Get GoPlus address security data for a wallet.
 */
async function getAddressSecurity(address: string, chain: string = 'base'): Promise<typeof EMPTY_GOPLUS_FLAGS & { available: boolean }> {
  const chainId = GOPLUS_API.chainIds[chain as keyof typeof GOPLUS_API.chainIds] ?? '8453';
  try {
    const resp = await axios.get(`${GOPLUS_API.baseUrl}/address_security/${address}`, {
      params: { chain_id: chainId },
      timeout: 5000,
    });

    const data = resp.data?.result;
    if (!data) return { ...EMPTY_GOPLUS_FLAGS, available: false };

    return {
      available: true,
      honeypot_related: toBool(data.honeypot_related_address),
      malicious_contracts_created: parseInt(data.number_of_malicious_contracts_created ?? '0', 10),
      phishing_activities: toBool(data.phishing_activities),
      stealing_attack: toBool(data.stealing_attack),
      money_laundering: toBool(data.money_laundering),
      sanctioned: toBool(data.sanctioned),
      mixer_usage: toBool(data.mixer),
      darkweb: toBool(data.darkweb_transactions),
      cybercrime: toBool(data.cybercrime),
      blackmail: toBool(data.blackmail_activities),
      fake_kyc: toBool(data.fake_kyc),
    };
  } catch (e) {
    log.warn(`GoPlus address_security failed for ${address}: ${(e as Error)?.message}`);
    return { ...EMPTY_GOPLUS_FLAGS, available: false };
  }
}

/**
 * Get deployer address from contract creation info.
 */
async function getDeployerAddress(tokenAddress: string): Promise<string | null> {
  try {
    const resp = await axios.get(BASESCAN_API.baseUrl, {
      params: {
        module: 'contract',
        action: 'getcontractcreation',
        contractaddresses: tokenAddress,
        apikey: BASESCAN_API.apiKey || undefined,
      },
      timeout: 5000,
    });
    return resp.data?.result?.[0]?.contractCreator ?? null;
  } catch {
    return null;
  }
}

/**
 * Get deployer transaction history for profiling.
 */
async function getDeployerProfile(deployerAddress: string): Promise<{
  walletAgeDays: number;
  contractCount: number;
  velocity24h: number;
  available: boolean;
}> {
  try {
    const resp = await axios.get(BASESCAN_API.baseUrl, {
      params: {
        module: 'account',
        action: 'txlist',
        address: deployerAddress,
        startblock: 0,
        endblock: 99999999,
        page: 1,
        offset: 200,
        sort: 'desc',
        apikey: BASESCAN_API.apiKey || undefined,
      },
      timeout: 8000,
    });

    const txs = resp.data?.result ?? [];
    if (!Array.isArray(txs) || txs.length === 0) {
      return { walletAgeDays: 0, contractCount: 0, velocity24h: 0, available: false };
    }

    // Count contract creations
    const creations = txs.filter((tx: Record<string, unknown>) =>
      (tx.to as string) === '' || (tx.to as string) === null,
    );

    // Wallet age
    const oldestTx = txs[txs.length - 1];
    const timestamp = parseInt(oldestTx.timeStamp as string, 10) * 1000;
    const walletAgeDays = timestamp > 0 ? Math.round((Date.now() - timestamp) / (1000 * 60 * 60 * 24)) : 0;

    // Deployment velocity: contracts in last 24h
    const oneDayAgo = Date.now() / 1000 - 86400;
    const recentCreations = creations.filter((tx: Record<string, unknown>) =>
      parseInt(tx.timeStamp as string, 10) > oneDayAgo,
    );

    return {
      walletAgeDays,
      contractCount: creations.length,
      velocity24h: recentCreations.length,
      available: true,
    };
  } catch (e) {
    log.warn(`Deployer profile fetch failed: ${(e as Error)?.message}`);
    return { walletAgeDays: 0, contractCount: 0, velocity24h: 0, available: false };
  }
}

/**
 * Compute deployer risk score (0-100, higher = more dangerous).
 */
function computeDeployerRisk(
  goplus: typeof EMPTY_GOPLUS_FLAGS & { available: boolean },
  profile: { walletAgeDays: number; contractCount: number; velocity24h: number; available: boolean },
): { score: number; criticalFlags: string[]; warningFlags: string[] } {
  let score = 0;
  const criticalFlags: string[] = [];
  const warningFlags: string[] = [];

  // GoPlus critical flags — these are KNOWN BAD actors, score harshly
  if (goplus.available) {
    if (goplus.honeypot_related) { score += 70; criticalFlags.push('HONEYPOT_CREATOR'); }
    if (goplus.malicious_contracts_created > 0) {
      score += Math.min(60, goplus.malicious_contracts_created * 20);
      criticalFlags.push(`MALICIOUS_CONTRACTS_${goplus.malicious_contracts_created}`);
    }
    if (goplus.phishing_activities) { score += 60; criticalFlags.push('PHISHING'); }
    if (goplus.stealing_attack) { score += 60; criticalFlags.push('STEALING_ATTACK'); }
    if (goplus.money_laundering) { score += 50; criticalFlags.push('MONEY_LAUNDERING'); }
    if (goplus.sanctioned) { score += 80; criticalFlags.push('SANCTIONED'); }
    if (goplus.mixer_usage) { score += 25; warningFlags.push('MIXER_USAGE'); }
    if (goplus.darkweb) { score += 50; criticalFlags.push('DARKWEB'); }
    if (goplus.cybercrime) { score += 50; criticalFlags.push('CYBERCRIME'); }
    if (goplus.fake_kyc) { score += 20; warningFlags.push('FAKE_KYC'); }
  }

  // Any critical flag = minimum 80 score. You don't get to be "SUSPICIOUS" as a honeypot creator.
  if (criticalFlags.length >= 2) {
    score = Math.max(score, 95);
  } else if (criticalFlags.length === 1) {
    score = Math.max(score, 80);
  }

  // Profile flags
  if (profile.available) {
    if (profile.walletAgeDays < 7) { score += 15; warningFlags.push('NEW_WALLET'); }
    else if (profile.walletAgeDays < 30) { score += 8; warningFlags.push('RECENT_WALLET'); }

    if (profile.contractCount > 20) { score += 15; warningFlags.push('SERIAL_DEPLOYER'); }
    else if (profile.contractCount > 10) { score += 8; warningFlags.push('ACTIVE_DEPLOYER'); }

    if (profile.velocity24h > 5) { score += 20; warningFlags.push('HIGH_VELOCITY_DEPLOYER'); }
    else if (profile.velocity24h > 2) { score += 10; warningFlags.push('MODERATE_VELOCITY'); }
  }

  // Positive signals — only if truly clean
  if (profile.available && profile.walletAgeDays > 365 && goplus.available && criticalFlags.length === 0 && warningFlags.length === 0) {
    score = Math.max(0, score - 10);
  }

  return { score: Math.min(100, Math.max(0, score)), criticalFlags, warningFlags };
}

/**
 * Main scan function for DeployerCheck.
 */
export async function scanDeployer(
  tokenAddress: string,
  chain: string = 'base',
): Promise<DeployerReport> {
  const startTime = Date.now();
  const sourcesAvailable: string[] = [];
  const sourcesFailed: string[] = [];

  // Step 1: Get deployer address
  let deployerAddress = await getDeployerAddress(tokenAddress);

  // Fallback: try GoPlus for creator_address
  if (!deployerAddress) {
    try {
      const chainId = GOPLUS_API.chainIds[chain as keyof typeof GOPLUS_API.chainIds] ?? '8453';
      const resp = await axios.get(`${GOPLUS_API.baseUrl}/token_security/${chainId}`, {
        params: { contract_addresses: tokenAddress.toLowerCase() },
        timeout: 5000,
      });
      deployerAddress = resp.data?.result?.[tokenAddress.toLowerCase()]?.creator_address ?? null;
    } catch { /* continue */ }
  }

  if (!deployerAddress) {
    return {
      token_address: tokenAddress,
      deployer_address: '',
      chain,
      timestamp: new Date().toISOString(),
      scan_time_ms: Date.now() - startTime,
      sources_available: [],
      sources_failed: ['all'],
      risk_score: -1,
      risk_level: 'NEUTRAL',
      verdict: `Could not determine deployer for ${tokenAddress}. Contract creation data unavailable.`,
      goplus_flags: EMPTY_GOPLUS_FLAGS,
      profile: { wallet_age_days: 0, total_contracts_deployed: 0, is_verified_deployer: false, deployment_velocity_24h: 0 },
      critical_flags: [],
      warning_flags: [],
    };
  }

  sourcesAvailable.push('basescan');

  // Step 2: Parallel fetch GoPlus address security + deployer profile
  const [goplusResult, profileResult] = await Promise.allSettled([
    getAddressSecurity(deployerAddress, chain),
    getDeployerProfile(deployerAddress),
  ]);

  const goplus = goplusResult.status === 'fulfilled' ? goplusResult.value : { ...EMPTY_GOPLUS_FLAGS, available: false };
  const profile = profileResult.status === 'fulfilled' ? profileResult.value : { walletAgeDays: 0, contractCount: 0, velocity24h: 0, available: false };

  if (goplus.available) sourcesAvailable.push('goplus_address');
  else sourcesFailed.push('goplus_address');

  if (profile.available) sourcesAvailable.push('basescan_profile');
  else sourcesFailed.push('basescan_profile');

  // Step 3: Compute risk
  const { score, criticalFlags, warningFlags } = computeDeployerRisk(goplus, profile);

  // Determine level
  let level: DeployerReport['risk_level'];
  if (criticalFlags.length > 0 || score >= 60) level = 'DANGEROUS';
  else if (score >= 30) level = 'SUSPICIOUS';
  else if (score >= 10) level = 'NEUTRAL';
  else level = 'TRUSTED';

  // Generate verdict
  let verdict: string;
  if (criticalFlags.length > 0) {
    verdict = `⛔ DANGEROUS: Deployer ${deployerAddress.substring(0, 10)}... flagged for ${criticalFlags.join(', ')}. Do not interact.`;
  } else if (warningFlags.length > 0) {
    verdict = `⚠️ ${level}: Deployer ${deployerAddress.substring(0, 10)}... has warnings: ${warningFlags.join(', ')}. Proceed with caution.`;
  } else if (profile.walletAgeDays > 180 && goplus.available) {
    verdict = `✅ TRUSTED: Deployer ${deployerAddress.substring(0, 10)}... is established (${profile.walletAgeDays} days old) with no flags.`;
  } else {
    verdict = `Deployer ${deployerAddress.substring(0, 10)}... risk score: ${score}/100 (${level}).`;
  }

  return {
    token_address: tokenAddress,
    deployer_address: deployerAddress,
    chain,
    timestamp: new Date().toISOString(),
    scan_time_ms: Date.now() - startTime,
    sources_available: sourcesAvailable,
    sources_failed: sourcesFailed,
    risk_score: score,
    risk_level: level,
    verdict,
    goplus_flags: {
      honeypot_related: goplus.honeypot_related,
      malicious_contracts_created: goplus.malicious_contracts_created,
      phishing_activities: goplus.phishing_activities,
      stealing_attack: goplus.stealing_attack,
      money_laundering: goplus.money_laundering,
      sanctioned: goplus.sanctioned,
      mixer_usage: goplus.mixer_usage,
      darkweb: goplus.darkweb,
      cybercrime: goplus.cybercrime,
      blackmail: goplus.blackmail,
      fake_kyc: goplus.fake_kyc,
    },
    profile: {
      wallet_age_days: profile.walletAgeDays,
      total_contracts_deployed: profile.contractCount,
      is_verified_deployer: profile.walletAgeDays > 180 && criticalFlags.length === 0,
      deployment_velocity_24h: profile.velocity24h,
    },
    critical_flags: criticalFlags,
    warning_flags: warningFlags,
  };
}

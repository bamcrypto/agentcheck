/**
 * ACP smart contract addresses on Base (Chain ID: 8453).
 * These need to be discovered by tracing agent wallet transactions.
 * Placeholders below — fill in after discovery.
 */

export const BASE_CHAIN_ID = 8453;

// RPC endpoints — Alchemy free tier
export const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://base-mainnet.g.alchemy.com/v2/demo';

// Basescan API
export const BASESCAN_API_KEY = process.env.BASESCAN_API_KEY || '';
export const BASESCAN_API_URL = 'https://api.basescan.org/api';

// ACP contract addresses (to be discovered)
export const ACP_CONTRACTS = {
  jobFactory: process.env.ACP_JOB_FACTORY || '',
  registry: process.env.ACP_REGISTRY || '',
  escrow: process.env.ACP_ESCROW || '',
} as const;

// VIRTUAL token on Base
export const VIRTUAL_TOKEN = '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b';

// Uniswap V3 factory on Base
export const UNISWAP_V3_FACTORY = '0x33128a8fC17869897dcE68Ed026d694621f6FDfD';
export const UNISWAP_V3_QUOTER = '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a';

// Aerodrome router on Base
export const AERODROME_ROUTER = '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43';

// WETH on Base
export const WETH_BASE = '0x4200000000000000000000000000000000000006';

// Known agent token examples (for initial testing)
export const KNOWN_AGENTS = {
  ETHY: {
    name: 'Ethy AI',
    ticker: '$ETHY',
    tokenAddress: '', // fill after discovery
    agentWallet: '', // fill after discovery
  },
} as const;

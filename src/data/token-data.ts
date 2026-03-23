import { ethers } from 'ethers';
import axios from 'axios';
import { getProvider, readContract } from '../utils/rpc.js';
import { UNISWAP_V3_FACTORY, WETH_BASE, BASESCAN_API_KEY, BASESCAN_API_URL } from '../config/contracts.js';
import { insertTokenMetrics } from './database.js';
import { cache, TTL } from './cache.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('token-data');

// ERC20 minimal ABI
const ERC20_ABI = [
  'function totalSupply() view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function balanceOf(address) view returns (uint256)',
];

// Uniswap V3 Pool ABI (minimal)
const POOL_ABI = [
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function liquidity() view returns (uint128)',
  'function fee() view returns (uint24)',
];

// Uniswap V3 Factory ABI
const FACTORY_ABI = [
  'function getPool(address tokenA, address tokenB, uint24 fee) view returns (address)',
];

const FEE_TIERS = [500, 3000, 10000]; // 0.05%, 0.3%, 1%

/**
 * Find the Uniswap V3 pool for a token paired with WETH.
 */
export async function findPool(tokenAddress: string): Promise<string | null> {
  const cacheKey = `pool:${tokenAddress}`;
  const cached = cache.get<string>(cacheKey);
  if (cached) return cached;

  const provider = getProvider();
  const factory = new ethers.Contract(UNISWAP_V3_FACTORY, FACTORY_ABI, provider);

  for (const fee of FEE_TIERS) {
    try {
      const poolAddress = await factory.getPool(tokenAddress, WETH_BASE, fee);
      if (poolAddress && poolAddress !== ethers.ZeroAddress) {
        cache.set(cacheKey, poolAddress, TTL.HISTORICAL);
        return poolAddress;
      }
    } catch {
      continue;
    }
  }

  log.warn(`No Uniswap V3 pool found for ${tokenAddress}`);
  return null;
}

/**
 * Get token price in USD via Uniswap V3 pool.
 * Path: Token -> WETH -> USD (using ETH/USD price)
 */
export async function getTokenPrice(tokenAddress: string): Promise<{
  priceUsd: number;
  priceEth: number;
} | null> {
  const cacheKey = `price:${tokenAddress}`;
  const cached = cache.get<{ priceUsd: number; priceEth: number }>(cacheKey);
  if (cached) return cached;

  try {
    const poolAddress = await findPool(tokenAddress);
    if (!poolAddress) return null;

    const provider = getProvider();
    const pool = new ethers.Contract(poolAddress, POOL_ABI, provider);

    const [slot0Data, token0, token1] = await Promise.all([
      pool.slot0(),
      pool.token0(),
      pool.token1(),
    ]);

    const sqrtPriceX96 = slot0Data[0];
    const isToken0 = token0.toLowerCase() === tokenAddress.toLowerCase();

    // Calculate price from sqrtPriceX96
    const sqrtPrice = Number(sqrtPriceX96) / (2 ** 96);
    const price = sqrtPrice * sqrtPrice;

    // Get token decimals
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const wethContract = new ethers.Contract(WETH_BASE, ERC20_ABI, provider);
    const [tokenDecimals, wethDecimals] = await Promise.all([
      tokenContract.decimals(),
      wethContract.decimals(),
    ]);

    // Adjust for decimals
    let priceInWeth: number;
    if (isToken0) {
      // price = token1/token0, so if our token is token0, price is in WETH terms
      priceInWeth = price * (10 ** (Number(tokenDecimals) - Number(wethDecimals)));
    } else {
      // price = token0/token1, our token is token1, invert
      priceInWeth = (1 / price) * (10 ** (Number(tokenDecimals) - Number(wethDecimals)));
    }

    // Get ETH price in USD
    const ethUsd = await getEthPrice();
    const priceUsd = priceInWeth * ethUsd;

    const result = { priceUsd, priceEth: priceInWeth };
    cache.set(cacheKey, result, TTL.TOKEN_PRICE);
    return result;
  } catch (e) {
    log.error(`Failed to get price for ${tokenAddress}`, e);
    return null;
  }
}

/**
 * Get ETH price in USD from CoinGecko.
 */
export async function getEthPrice(): Promise<number> {
  const cacheKey = 'ethPrice';
  const cached = cache.get<number>(cacheKey);
  if (cached) return cached;

  try {
    const resp = await axios.get(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
    );
    const price = resp.data?.ethereum?.usd ?? 0;
    cache.set(cacheKey, price, TTL.TOKEN_PRICE);
    return price;
  } catch (e) {
    log.error('Failed to get ETH price', e);
    return 0;
  }
}

/**
 * Get token market cap.
 */
export async function getMarketCap(tokenAddress: string): Promise<number> {
  try {
    const priceData = await getTokenPrice(tokenAddress);
    if (!priceData) return 0;

    const provider = getProvider();
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const [totalSupply, decimals] = await Promise.all([
      token.totalSupply(),
      token.decimals(),
    ]);

    const supply = parseFloat(ethers.formatUnits(totalSupply, decimals));
    return supply * priceData.priceUsd;
  } catch (e) {
    log.error(`Failed to get market cap for ${tokenAddress}`, e);
    return 0;
  }
}

/**
 * Get token holder count from Basescan API.
 */
export async function getHolderCount(tokenAddress: string): Promise<number> {
  if (!BASESCAN_API_KEY) return 0;

  const cacheKey = `holders:${tokenAddress}`;
  const cached = cache.get<number>(cacheKey);
  if (cached) return cached;

  try {
    const resp = await axios.get(BASESCAN_API_URL, {
      params: {
        module: 'token',
        action: 'tokenholdercount',
        contractaddress: tokenAddress,
        apikey: BASESCAN_API_KEY,
      },
    });
    const count = parseInt(resp.data?.result ?? '0', 10);
    cache.set(cacheKey, count, 60 * 60 * 1000); // 1 hour
    return count;
  } catch {
    return 0;
  }
}

/**
 * Get pool liquidity in USD.
 */
export async function getPoolLiquidity(tokenAddress: string): Promise<number> {
  try {
    const poolAddress = await findPool(tokenAddress);
    if (!poolAddress) return 0;

    const provider = getProvider();
    const pool = new ethers.Contract(poolAddress, POOL_ABI, provider);
    const weth = new ethers.Contract(WETH_BASE, ERC20_ABI, provider);

    // Get WETH balance in pool as proxy for liquidity
    const wethBalance = await weth.balanceOf(poolAddress);
    const ethUsd = await getEthPrice();
    const wethInPool = parseFloat(ethers.formatEther(wethBalance));

    return wethInPool * ethUsd * 2; // multiply by 2 for both sides of pool
  } catch {
    return 0;
  }
}

/**
 * Collect and store all token metrics for a given token.
 */
export async function collectTokenMetrics(tokenAddress: string): Promise<void> {
  const [priceData, marketCap, holderCount, liquidity] = await Promise.all([
    getTokenPrice(tokenAddress),
    getMarketCap(tokenAddress),
    getHolderCount(tokenAddress),
    getPoolLiquidity(tokenAddress),
  ]);

  await insertTokenMetrics({
    tokenAddress,
    timestamp: new Date().toISOString(),
    priceUsd: priceData?.priceUsd ?? 0,
    marketCap,
    holderCount,
    volume24h: 0, // TODO: aggregate from swap events
    liquidityUsd: liquidity,
  });

  log.info(`Collected token metrics for ${tokenAddress}: price=$${priceData?.priceUsd?.toFixed(6) ?? 0}, mcap=$${marketCap.toFixed(0)}`);
}

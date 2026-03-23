import { ethers } from 'ethers';
import { BASE_RPC_URL } from '../config/contracts.js';

let provider: ethers.JsonRpcProvider | null = null;

export function getProvider(): ethers.JsonRpcProvider {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
  }
  return provider;
}

/**
 * Query past event logs from a contract.
 */
export async function getLogs(params: {
  address: string;
  topics: (string | null)[];
  fromBlock: number;
  toBlock: number | 'latest';
}): Promise<ethers.Log[]> {
  const p = getProvider();
  return p.getLogs({
    address: params.address,
    topics: params.topics,
    fromBlock: params.fromBlock,
    toBlock: params.toBlock,
  });
}

/**
 * Batch getLogs with chunking to avoid RPC limits.
 * Most free-tier RPCs limit to ~2000 blocks per query.
 */
export async function getLogsChunked(params: {
  address: string;
  topics: (string | null)[];
  fromBlock: number;
  toBlock: number;
  chunkSize?: number;
}): Promise<ethers.Log[]> {
  const chunkSize = params.chunkSize || 2000;
  const allLogs: ethers.Log[] = [];
  let from = params.fromBlock;

  while (from <= params.toBlock) {
    const to = Math.min(from + chunkSize - 1, params.toBlock);
    const logs = await getLogs({
      address: params.address,
      topics: params.topics,
      fromBlock: from,
      toBlock: to,
    });
    allLogs.push(...logs);
    from = to + 1;
  }

  return allLogs;
}

/**
 * Get the current block number.
 */
export async function getBlockNumber(): Promise<number> {
  return getProvider().getBlockNumber();
}

/**
 * Get block timestamp.
 */
export async function getBlockTimestamp(blockNumber: number): Promise<number> {
  const block = await getProvider().getBlock(blockNumber);
  return block?.timestamp ?? 0;
}

/**
 * Read a contract view function.
 */
export async function readContract(
  address: string,
  abi: string[],
  functionName: string,
  args: unknown[] = [],
): Promise<unknown> {
  const contract = new ethers.Contract(address, abi, getProvider());
  return contract[functionName](...args);
}

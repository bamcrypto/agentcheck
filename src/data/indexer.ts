import { getBlockNumber } from '../utils/rpc.js';
import { fetchJobEvents } from './agent-data.js';
import { getDb, saveDb } from './database.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('indexer');

// Store last indexed block in the database
const INDEXER_STATE_KEY = 'last_indexed_block';

async function getLastIndexedBlock(): Promise<number> {
  const database = await getDb();
  // Create state table if needed
  database.run(`
    CREATE TABLE IF NOT EXISTS indexer_state (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  const result = database.exec(
    `SELECT value FROM indexer_state WHERE key = '${INDEXER_STATE_KEY}'`,
  );

  if (result.length && result[0].values.length) {
    return parseInt(result[0].values[0][0] as string, 10);
  }

  // ACP on Base launched ~July 2025. Base block time is ~2s.
  // Approximate starting block — adjust after checking actual deployment block.
  return 15_000_000;
}

async function setLastIndexedBlock(block: number): Promise<void> {
  const database = await getDb();
  database.run(
    `INSERT OR REPLACE INTO indexer_state (key, value) VALUES (?, ?)`,
    [INDEXER_STATE_KEY, block.toString()],
  );
  saveDb();
}

/**
 * Index new on-chain events from last checkpoint to current block.
 */
export async function indexNewEvents(): Promise<{ fromBlock: number; toBlock: number; }> {
  const lastBlock = await getLastIndexedBlock();
  const currentBlock = await getBlockNumber();

  if (currentBlock <= lastBlock) {
    log.info('Already up to date');
    return { fromBlock: lastBlock, toBlock: currentBlock };
  }

  log.info(`Indexing blocks ${lastBlock + 1} to ${currentBlock} (${currentBlock - lastBlock} blocks)`);

  await fetchJobEvents(lastBlock + 1, currentBlock);
  await setLastIndexedBlock(currentBlock);

  log.info(`Indexed up to block ${currentBlock}`);
  return { fromBlock: lastBlock + 1, toBlock: currentBlock };
}

/**
 * Run a full historical backfill from ACP deployment to present.
 * This can take a long time — designed to be run once.
 */
export async function runHistoricalBackfill(startBlock?: number): Promise<void> {
  const from = startBlock ?? 15_000_000; // approximate ACP deployment block
  const currentBlock = await getBlockNumber();

  log.info(`Starting historical backfill from block ${from} to ${currentBlock}`);

  const chunkSize = 10000;
  let processed = from;

  while (processed < currentBlock) {
    const to = Math.min(processed + chunkSize, currentBlock);
    await fetchJobEvents(processed, to);
    await setLastIndexedBlock(to);

    const progress = ((to - from) / (currentBlock - from) * 100).toFixed(1);
    log.info(`Backfill progress: ${progress}% (block ${to}/${currentBlock})`);

    processed = to + 1;
  }

  log.info('Historical backfill complete');
}

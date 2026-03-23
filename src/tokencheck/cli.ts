import { scanToken, type ScanDepth } from './scanner.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('tokencheck');

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('TokenCheck — Token Intelligence for ACP');
    console.log('');
    console.log('Usage:');
    console.log('  npx tsx src/tokencheck/cli.ts <address|symbol> [depth] [chain]');
    console.log('');
    console.log('Depth levels:');
    console.log('  quick      — Safety check only (GoPlus + DexScreener)');
    console.log('  standard   — Full analysis (+ Basescan + CoinGecko)');
    console.log('  technical  — + RSI, MACD, Bollinger, MAs');
    console.log('  full       — Everything combined');
    console.log('');
    console.log('Examples:');
    console.log('  npx tsx src/tokencheck/cli.ts 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
    console.log('  npx tsx src/tokencheck/cli.ts VIRTUAL full');
    console.log('  npx tsx src/tokencheck/cli.ts 0x... quick base');
    return;
  }

  const token = args[0];
  const depth = (args[1] ?? 'standard') as ScanDepth;
  const chain = args[2] ?? 'base';

  log.info(`Scanning ${token} (depth: ${depth}, chain: ${chain})...`);

  const result = await scanToken(token, chain, depth);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  log.error('Fatal error', e);
  process.exit(1);
});

import { scanSentiment } from './scanner.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('sentimentcheck');

async function main(): Promise<void> {
  const token = process.argv[2];
  const chain = process.argv[3] ?? 'base';

  if (!token) {
    console.log('SentimentCheck — Social Momentum Intelligence');
    console.log('');
    console.log('Usage: npx tsx src/sentimentcheck/cli.ts <token_address> [chain]');
    console.log('');
    console.log('Examples:');
    console.log('  npx tsx src/sentimentcheck/cli.ts 0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b');
    return;
  }

  log.info(`Scanning sentiment for ${token} on ${chain}...`);
  const result = await scanSentiment(token, chain);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  log.error('Fatal error', e);
  process.exit(1);
});

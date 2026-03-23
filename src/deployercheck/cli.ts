import { scanDeployer } from './scanner.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('deployercheck');

async function main(): Promise<void> {
  const token = process.argv[2];
  const chain = process.argv[3] ?? 'base';

  if (!token) {
    console.log('DeployerCheck — Deployer Reputation Intelligence');
    console.log('');
    console.log('Usage: npx tsx src/deployercheck/cli.ts <token_address> [chain]');
    console.log('');
    console.log('Examples:');
    console.log('  npx tsx src/deployercheck/cli.ts 0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b');
    console.log('  npx tsx src/deployercheck/cli.ts 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 base');
    return;
  }

  log.info(`Scanning deployer for ${token} on ${chain}...`);
  const result = await scanDeployer(token, chain);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  log.error('Fatal error', e);
  process.exit(1);
});

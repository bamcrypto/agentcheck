import { resolveTokenAddress } from './data-sources/coingecko.js';

async function main() {
  const symbols = ['USDC', 'WETH', 'DAI', 'VIRTUAL', 'AERO', 'DEGEN', 'BRETT', 'cbbtc', '$VIRTUAL', 'toshi', 'nonexistent_token_xyz'];
  for (const sym of symbols) {
    const addr = await resolveTokenAddress(sym, 'base');
    console.log(`${sym.padEnd(25)} → ${addr ?? 'FAILED'}`);
  }
}
main();

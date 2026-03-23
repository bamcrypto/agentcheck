/**
 * TokenScope Comprehensive Test Suite
 * Tests against real tokens on Base to validate scoring accuracy.
 */

import { scanToken, type ScanDepth } from './scanner.js';
import { checkTokenSecurity } from './data-sources/goplus.js';
import { getTokenData } from './data-sources/dexscreener.js';
import { getContractInfo } from './data-sources/basescan.js';
import { getTokenInfo, getPriceHistory, resolveTokenAddress } from './data-sources/coingecko.js';
import { computeTA } from './technical-analysis.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('test');

interface TestCase {
  name: string;
  token: string;
  chain?: string;
  depth?: ScanDepth;
  expectedLevel?: ('SAFE' | 'CAUTION' | 'DANGER' | 'AVOID')[];
  expectedScoreRange?: [number, number]; // [min, max]
  expectedFlags?: string[];  // flags that SHOULD be present
  unexpectedFlags?: string[]; // flags that should NOT be present
  mustHaveSources?: string[];
  description: string;
}

const TEST_CASES: TestCase[] = [
  // ─── CATEGORY 1: Known Safe Tokens ────────────────────────────────
  {
    name: 'USDC (Base)',
    token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    depth: 'standard',
    expectedLevel: ['SAFE'],
    expectedScoreRange: [0, 30],
    unexpectedFlags: ['HONEYPOT', 'AIRDROP_SCAM'],
    mustHaveSources: ['goplus', 'dexscreener'],
    description: 'Major stablecoin — must be SAFE',
  },
  {
    name: 'WETH (Base)',
    token: '0x4200000000000000000000000000000000000006',
    depth: 'standard',
    expectedLevel: ['SAFE'],
    expectedScoreRange: [0, 25],
    unexpectedFlags: ['HONEYPOT'],
    description: 'Wrapped ETH — must be SAFE',
  },
  {
    name: 'DEGEN (Base)',
    token: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed',
    depth: 'standard',
    expectedLevel: ['SAFE', 'CAUTION'],
    expectedScoreRange: [0, 40],
    description: 'Popular memecoin, should be SAFE or low CAUTION',
  },
  {
    name: 'BRETT (Base)',
    token: '0x532f27101965dd16442E59d40670FaF5eBB142E4',
    depth: 'standard',
    expectedLevel: ['SAFE', 'CAUTION'],
    expectedScoreRange: [0, 40],
    description: 'Major Base memecoin',
  },
  {
    name: 'VIRTUAL (Base)',
    token: '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b',
    depth: 'full',
    expectedLevel: ['SAFE', 'CAUTION'],
    expectedScoreRange: [10, 50],
    description: 'Virtuals Protocol token — has mintable flag, should be CAUTION max',
  },
  {
    name: 'cbBTC (Base)',
    token: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
    depth: 'standard',
    expectedLevel: ['SAFE', 'CAUTION'],
    expectedScoreRange: [0, 35],
    description: 'Coinbase wrapped BTC',
  },
  {
    name: 'AERO (Base)',
    token: '0x940181a94A35A4569E4529A3CDfB74e38FD98631',
    depth: 'standard',
    expectedLevel: ['SAFE', 'CAUTION'],
    expectedScoreRange: [0, 40],
    description: 'Aerodrome DEX token',
  },

  // ─── CATEGORY 2: Symbol Resolution ────────────────────────────────
  {
    name: 'VIRTUAL (by symbol)',
    token: 'VIRTUAL',
    depth: 'quick',
    expectedLevel: ['SAFE', 'CAUTION'],
    description: 'Symbol resolution test',
  },
  {
    name: '$DEGEN (with $ prefix)',
    token: '$DEGEN',
    depth: 'quick',
    expectedLevel: ['SAFE', 'CAUTION'],
    description: 'Symbol with $ prefix should resolve',
  },
  {
    name: 'USDC (by symbol)',
    token: 'USDC',
    depth: 'quick',
    expectedLevel: ['SAFE'],
    description: 'Known token symbol resolution',
  },

  // ─── CATEGORY 3: Edge Cases ───────────────────────────────────────
  {
    name: 'Invalid address (too short)',
    token: '0xDEAD',
    depth: 'quick',
    expectedLevel: ['AVOID'],
    description: 'Should return error, not crash',
  },
  {
    name: 'Nonexistent token',
    token: '0x0000000000000000000000000000000000000001',
    depth: 'quick',
    description: 'Should handle gracefully with partial data',
  },
  {
    name: 'Empty string',
    token: '',
    depth: 'quick',
    description: 'Should return error',
  },
  {
    name: 'Random gibberish',
    token: 'asdfghjkl123456',
    depth: 'quick',
    description: 'Should fail gracefully',
  },

  // ─── CATEGORY 4: Depth Level Tests ────────────────────────────────
  {
    name: 'VIRTUAL quick (minimal)',
    token: '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b',
    depth: 'quick',
    description: 'Quick should NOT have token/contract/technical fields',
  },
  {
    name: 'VIRTUAL standard',
    token: '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b',
    depth: 'standard',
    description: 'Standard should have token + contract, NOT technical',
  },
  {
    name: 'VIRTUAL full',
    token: '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b',
    depth: 'full',
    description: 'Full should have everything including technical',
  },
];

// ─── Individual Data Source Tests ────────────────────────────────────

async function testGoPlus(): Promise<{ passed: number; failed: number; results: string[] }> {
  const results: string[] = [];
  let passed = 0;
  let failed = 0;

  // Test 1: Known good token
  const usdc = await checkTokenSecurity('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 'base');
  if (usdc.available) {
    results.push('✅ GoPlus: USDC returns data');
    if (!usdc.is_honeypot) { results.push('✅ GoPlus: USDC not flagged as honeypot'); passed++; }
    else { results.push('❌ GoPlus: USDC incorrectly flagged as honeypot'); failed++; }
    if (usdc.holder_count > 10000) { results.push(`✅ GoPlus: USDC holder count realistic (${usdc.holder_count})`); passed++; }
    else { results.push(`⚠️ GoPlus: USDC holder count low (${usdc.holder_count})`); }
    if (usdc.buy_tax === 0 && usdc.sell_tax === 0) { results.push('✅ GoPlus: USDC zero tax'); passed++; }
    else { results.push(`❌ GoPlus: USDC shows tax (buy: ${usdc.buy_tax}%, sell: ${usdc.sell_tax}%)`); failed++; }
    passed++;
  } else {
    results.push('❌ GoPlus: USDC returned no data');
    failed++;
  }

  // Test 2: VIRTUAL token
  const virtual = await checkTokenSecurity('0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b', 'base');
  if (virtual.available) {
    results.push('✅ GoPlus: VIRTUAL returns data');
    results.push(`   Honeypot: ${virtual.is_honeypot}, Mintable: ${virtual.has_mint_function}, Proxy: ${virtual.is_proxy}`);
    results.push(`   Buy tax: ${virtual.buy_tax}%, Sell tax: ${virtual.sell_tax}%`);
    results.push(`   Holders: ${virtual.holder_count}, Top holders: ${virtual.top_holders.length}`);
    passed++;
  } else {
    results.push('❌ GoPlus: VIRTUAL returned no data');
    failed++;
  }

  return { passed, failed, results };
}

async function testDexScreener(): Promise<{ passed: number; failed: number; results: string[] }> {
  const results: string[] = [];
  let passed = 0;
  let failed = 0;

  const usdc = await getTokenData('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 'base');
  if (usdc.available) {
    results.push('✅ DexScreener: USDC returns data');
    if (usdc.total_liquidity_usd > 1000000) { results.push(`✅ DexScreener: USDC liquidity realistic ($${(usdc.total_liquidity_usd/1e6).toFixed(1)}M)`); passed++; }
    else { results.push(`⚠️ DexScreener: USDC liquidity low ($${usdc.total_liquidity_usd})`); }
    if (usdc.pair_count > 5) { results.push(`✅ DexScreener: USDC has ${usdc.pair_count} pairs`); passed++; }
    else { results.push(`⚠️ DexScreener: USDC only ${usdc.pair_count} pairs`); }
    passed++;
  } else {
    results.push('❌ DexScreener: USDC returned no data');
    failed++;
  }

  const virtual = await getTokenData('0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b', 'base');
  if (virtual.available) {
    results.push(`✅ DexScreener: VIRTUAL price=$${virtual.price_usd}, liq=$${(virtual.total_liquidity_usd/1e6).toFixed(1)}M, vol=$${(virtual.total_volume_24h/1e6).toFixed(1)}M`);
    passed++;
  } else {
    results.push('❌ DexScreener: VIRTUAL returned no data');
    failed++;
  }

  return { passed, failed, results };
}

async function testBasescan(): Promise<{ passed: number; failed: number; results: string[] }> {
  const results: string[] = [];
  let passed = 0;
  let failed = 0;

  const usdc = await getContractInfo('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
  if (usdc.available) {
    results.push('✅ Basescan: USDC returns data');
    if (usdc.is_verified) { results.push('✅ Basescan: USDC is verified'); passed++; }
    else { results.push('⚠️ Basescan: USDC not verified (may be proxy)'); }
    if (usdc.deployer_address) { results.push(`✅ Basescan: USDC deployer found: ${usdc.deployer_address.substring(0, 10)}...`); passed++; }
    passed++;
  } else {
    results.push('❌ Basescan: USDC returned no data');
    failed++;
  }

  return { passed, failed, results };
}

async function testCoinGecko(): Promise<{ passed: number; failed: number; results: string[] }> {
  const results: string[] = [];
  let passed = 0;
  let failed = 0;

  // Token info
  const virtual = await getTokenInfo('0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b', 'base');
  if (virtual.available) {
    results.push(`✅ CoinGecko: VIRTUAL name="${virtual.name}", symbol="${virtual.symbol}", mcap=$${(virtual.market_cap/1e6).toFixed(0)}M`);
    if (virtual.market_cap > 1e6) { results.push('✅ CoinGecko: VIRTUAL market cap realistic'); passed++; }
    passed++;
  } else {
    results.push('❌ CoinGecko: VIRTUAL token info unavailable');
    failed++;
  }

  // Price history
  const history = await getPriceHistory('0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b', 'base', 14);
  if (history.available) {
    results.push(`✅ CoinGecko: VIRTUAL price history: ${history.prices.length} data points`);
    if (history.prices.length > 100) { results.push('✅ CoinGecko: Sufficient data for TA'); passed++; }
    else { results.push(`⚠️ CoinGecko: Only ${history.prices.length} data points (need 30+)`); }
    passed++;
  } else {
    results.push('❌ CoinGecko: VIRTUAL price history unavailable');
    failed++;
  }

  // Symbol resolution
  const resolved = await resolveTokenAddress('VIRTUAL', 'base');
  if (resolved) {
    results.push(`✅ CoinGecko: "VIRTUAL" resolved to ${resolved}`);
    if (resolved.toLowerCase() === '0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b') {
      results.push('✅ CoinGecko: Correct address resolved');
      passed++;
    } else {
      results.push(`⚠️ CoinGecko: Resolved to different address: ${resolved}`);
    }
    passed++;
  } else {
    results.push('❌ CoinGecko: Could not resolve "VIRTUAL"');
    failed++;
  }

  return { passed, failed, results };
}

async function testTA(): Promise<{ passed: number; failed: number; results: string[] }> {
  const results: string[] = [];
  let passed = 0;
  let failed = 0;

  // Test with real price data
  const history = await getPriceHistory('0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b', 'base', 14);
  if (!history.available) {
    results.push('❌ TA: No price history available for testing');
    return { passed, failed: 1, results };
  }

  const ta = computeTA(history.prices);

  if (ta.available) {
    results.push(`✅ TA: Analysis computed (${ta.data_points} data points)`);
    passed++;

    // RSI bounds check
    if (ta.rsi_14 >= 0 && ta.rsi_14 <= 100) {
      results.push(`✅ TA: RSI in valid range: ${ta.rsi_14}`);
      passed++;
    } else {
      results.push(`❌ TA: RSI out of range: ${ta.rsi_14}`);
      failed++;
    }

    // MACD sanity
    if (typeof ta.macd.macd === 'number' && !isNaN(ta.macd.macd)) {
      results.push(`✅ TA: MACD valid: ${ta.macd.macd} (signal: ${ta.macd.signal}, hist: ${ta.macd.histogram})`);
      passed++;
    } else {
      results.push(`❌ TA: MACD invalid: ${JSON.stringify(ta.macd)}`);
      failed++;
    }

    // Bollinger sanity: upper > middle > lower
    if (ta.bollinger.upper > ta.bollinger.middle && ta.bollinger.middle > ta.bollinger.lower) {
      results.push(`✅ TA: Bollinger bands valid: ${ta.bollinger.lower.toFixed(4)} < ${ta.bollinger.middle.toFixed(4)} < ${ta.bollinger.upper.toFixed(4)}`);
      passed++;
    } else {
      results.push(`❌ TA: Bollinger bands invalid: lower=${ta.bollinger.lower}, mid=${ta.bollinger.middle}, upper=${ta.bollinger.upper}`);
      failed++;
    }

    // SMA sanity: should be close to current price
    const priceDiffPct = Math.abs(ta.sma_20 - ta.current_price) / ta.current_price * 100;
    if (priceDiffPct < 30) {
      results.push(`✅ TA: SMA20 within 30% of price (diff: ${priceDiffPct.toFixed(1)}%)`);
      passed++;
    } else {
      results.push(`⚠️ TA: SMA20 far from price (diff: ${priceDiffPct.toFixed(1)}%)`);
    }

    // Support < current price < resistance (usually)
    results.push(`   TA: Support=$${ta.support}, Price=$${ta.current_price}, Resistance=$${ta.resistance}`);
    results.push(`   TA: Trend=${ta.trend}, Summary: ${ta.summary}`);

    // Test with insufficient data
    const shortTA = computeTA(history.prices.slice(0, 10));
    if (!shortTA.available) {
      results.push('✅ TA: Correctly rejects insufficient data (10 points)');
      passed++;
    } else {
      results.push('⚠️ TA: Accepted only 10 data points (expected rejection)');
    }

    // Test with empty data
    const emptyTA = computeTA([]);
    if (!emptyTA.available) {
      results.push('✅ TA: Correctly handles empty data');
      passed++;
    } else {
      results.push('❌ TA: Did not handle empty data');
      failed++;
    }
  } else {
    results.push('❌ TA: Analysis failed');
    failed++;
  }

  return { passed, failed, results };
}

// ─── Main Test Runner ───────────────────────────────────────────────

async function runAllTests(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           TokenScope Comprehensive Test Suite               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  let totalPassed = 0;
  let totalFailed = 0;
  let totalWarnings = 0;

  // Phase 1: Individual Data Source Tests
  console.log('━━━ PHASE 1: Data Source Validation ━━━\n');

  const sources = [
    { name: 'GoPlus Security API', fn: testGoPlus },
    { name: 'DexScreener API', fn: testDexScreener },
    { name: 'Basescan API', fn: testBasescan },
    { name: 'CoinGecko API', fn: testCoinGecko },
    { name: 'Technical Analysis Engine', fn: testTA },
  ];

  for (const source of sources) {
    console.log(`\n── ${source.name} ──`);
    try {
      const result = await source.fn();
      totalPassed += result.passed;
      totalFailed += result.failed;
      for (const line of result.results) {
        console.log(`  ${line}`);
        if (line.startsWith('⚠️')) totalWarnings++;
      }
    } catch (e: any) {
      console.log(`  ❌ CRASH: ${e.message}`);
      totalFailed++;
    }
  }

  // Phase 2: Full Scanner Integration Tests
  console.log('\n\n━━━ PHASE 2: Full Scanner Integration Tests ━━━\n');

  for (const tc of TEST_CASES) {
    const startTime = Date.now();
    try {
      const result = await scanToken(tc.token, tc.chain ?? 'base', tc.depth ?? 'quick');
      const elapsed = Date.now() - startTime;

      let status = '✅';
      const issues: string[] = [];

      // Check expected level
      if (tc.expectedLevel && !tc.expectedLevel.includes(result.risk.level)) {
        status = '❌';
        issues.push(`level=${result.risk.level} (expected ${tc.expectedLevel.join('|')})`);
        totalFailed++;
      }

      // Check score range
      if (tc.expectedScoreRange) {
        const [min, max] = tc.expectedScoreRange;
        if (result.risk.overall < min || result.risk.overall > max) {
          status = '❌';
          issues.push(`score=${result.risk.overall} (expected ${min}-${max})`);
          totalFailed++;
        }
      }

      // Check expected flags
      if (tc.expectedFlags) {
        for (const flag of tc.expectedFlags) {
          const allFlags = [
            ...result.risk.critical_flags,
            ...Object.values(result.risk.dimensions).flatMap(d => d.details),
          ];
          if (!allFlags.some(f => f.toLowerCase().includes(flag.toLowerCase()))) {
            status = '⚠️';
            issues.push(`missing flag: ${flag}`);
            totalWarnings++;
          }
        }
      }

      // Check unexpected flags
      if (tc.unexpectedFlags) {
        for (const flag of tc.unexpectedFlags) {
          if (result.risk.critical_flags.some(f => f.toLowerCase().includes(flag.toLowerCase()))) {
            status = '❌';
            issues.push(`unexpected critical flag: ${flag}`);
            totalFailed++;
          }
        }
      }

      // Check required sources
      if (tc.mustHaveSources) {
        for (const src of tc.mustHaveSources) {
          if (!result.sources_available.includes(src)) {
            status = '⚠️';
            issues.push(`missing source: ${src}`);
            totalWarnings++;
          }
        }
      }

      // Check depth-specific fields
      if (tc.depth === 'quick' && (result.token || result.contract || result.technical)) {
        status = '⚠️';
        issues.push('quick scan should not have token/contract/technical');
        totalWarnings++;
      }
      if (tc.depth === 'standard' && !result.token) {
        status = '❌';
        issues.push('standard scan missing token info');
        totalFailed++;
      }
      if (tc.depth === 'full' && !result.technical) {
        status = '⚠️';
        issues.push('full scan missing technical analysis');
        totalWarnings++;
      }

      // Performance check
      if (elapsed > 10000) {
        issues.push(`SLOW: ${elapsed}ms`);
        totalWarnings++;
      }

      if (status === '✅') totalPassed++;

      const issueStr = issues.length > 0 ? ` — ${issues.join(', ')}` : '';
      console.log(`  ${status} ${tc.name}: ${result.risk.level} (${result.risk.overall}/100) ${elapsed}ms [${result.sources_available.length}/${result.sources_available.length + result.sources_failed.length} sources]${issueStr}`);

    } catch (e: any) {
      console.log(`  ❌ ${tc.name}: CRASH — ${e.message}`);
      totalFailed++;
    }
  }

  // Phase 3: Performance Benchmark
  console.log('\n\n━━━ PHASE 3: Performance Benchmark ━━━\n');

  const perfToken = '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b';
  const depths: ScanDepth[] = ['quick', 'standard', 'technical', 'full'];

  for (const depth of depths) {
    const times: number[] = [];
    for (let i = 0; i < 3; i++) {
      const start = Date.now();
      await scanToken(perfToken, 'base', depth);
      times.push(Date.now() - start);
    }
    const avg = Math.round(times.reduce((s, t) => s + t, 0) / times.length);
    const max = Math.max(...times);
    const min = Math.min(...times);
    const passPerf = avg < 5000;
    console.log(`  ${passPerf ? '✅' : '⚠️'} ${depth.padEnd(12)} avg=${avg}ms  min=${min}ms  max=${max}ms`);
    if (passPerf) totalPassed++; else totalWarnings++;
  }

  // Summary
  console.log('\n\n╔══════════════════════════════════════════════════════════════╗');
  console.log(`║  RESULTS: ${totalPassed} passed, ${totalFailed} failed, ${totalWarnings} warnings${' '.repeat(Math.max(0, 22 - String(totalPassed + totalFailed + totalWarnings).length))}║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');

  if (totalFailed > 0) {
    console.log('\n⛔ TEST SUITE FAILED — Fix failures before deploying.');
    process.exit(1);
  } else if (totalWarnings > 0) {
    console.log('\n⚠️ Tests passed with warnings. Review before deploying.');
  } else {
    console.log('\n🎯 ALL TESTS PASSED. Ready to deploy.');
  }
}

runAllTests().catch((e) => {
  console.error('Test suite crashed:', e);
  process.exit(1);
});

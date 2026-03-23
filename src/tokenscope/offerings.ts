/**
 * ACP Offering definitions for TokenScope agent.
 * Descriptions optimized for Butler keyword discovery.
 */

export const TOKEN_OFFERINGS = [
  {
    name: 'quick_scan',
    description:
      'Fast 3-second token safety check before trading. Returns risk score (0-100), ' +
      'honeypot detection, tax analysis, liquidity check, holder concentration, and ' +
      'go/no-go verdict. Use before any swap or trade. ' +
      'Is this token safe? Check token security. Scan token. Token risk check. ' +
      'Honeypot check. Rug pull detection. Token safety. Is this a scam?',
    price: 0.05,
    slaMinutes: 1,
    requirement: {
      type: 'object',
      required: ['token'],
      properties: {
        token: { type: 'string', description: 'Token contract address (0x...) or symbol' },
        chain: { type: 'string', description: 'Chain: base (default), ethereum, bsc, arbitrum, polygon' },
      },
    },
    deliverable: {
      type: 'object',
      properties: {
        risk: { type: 'object', description: 'Risk score, level, flags, and verdict' },
        verdict: { type: 'string' },
      },
    },
  },
  {
    name: 'token_analysis',
    description:
      'Comprehensive token intelligence report. Security audit + price data + liquidity ' +
      'analysis + holder distribution + deployer reputation. Aggregates GoPlus, DexScreener, ' +
      'Basescan, and CoinGecko data in one call. ' +
      'Token info. Token analysis. Token report. Full token check. ' +
      'Token security audit. Smart contract audit. Token research. Due diligence.',
    price: 0.15,
    slaMinutes: 1,
    requirement: {
      type: 'object',
      required: ['token'],
      properties: {
        token: { type: 'string', description: 'Token contract address (0x...) or symbol' },
        chain: { type: 'string', description: 'Chain: base (default), ethereum, bsc, arbitrum, polygon' },
      },
    },
    deliverable: {
      type: 'object',
      properties: {
        risk: { type: 'object' },
        token: { type: 'object' },
        contract: { type: 'object' },
        verdict: { type: 'string' },
      },
    },
  },
  {
    name: 'technical_analysis',
    description:
      'Full technical analysis with RSI, MACD, Bollinger Bands, moving averages, ' +
      'support/resistance levels, and trend signal. Uses 14 days of hourly price data. ' +
      'Also includes risk assessment and token fundamentals. ' +
      'TA. Technical analysis. RSI. MACD. Chart analysis. Price prediction. ' +
      'Trading signals. Should I buy? Trend analysis. Market analysis.',
    price: 0.50,
    slaMinutes: 2,
    requirement: {
      type: 'object',
      required: ['token'],
      properties: {
        token: { type: 'string', description: 'Token contract address (0x...) or symbol' },
        chain: { type: 'string', description: 'Chain: base (default), ethereum, bsc, arbitrum, polygon' },
      },
    },
    deliverable: {
      type: 'object',
      properties: {
        risk: { type: 'object' },
        token: { type: 'object' },
        contract: { type: 'object' },
        technical: { type: 'object' },
        verdict: { type: 'string' },
      },
    },
  },
  {
    name: 'full_report',
    description:
      'Complete token intelligence report combining security audit, market data, ' +
      'holder analysis, deployer reputation, and full technical analysis (RSI, MACD, ' +
      'Bollinger, MAs). One call replaces 5 separate agent calls. ' +
      'Full token report. Complete analysis. Deep dive. Everything about this token. ' +
      'Comprehensive token research. Full audit.',
    price: 0.75,
    slaMinutes: 2,
    requirement: {
      type: 'object',
      required: ['token'],
      properties: {
        token: { type: 'string', description: 'Token contract address (0x...) or symbol' },
        chain: { type: 'string', description: 'Chain: base (default), ethereum, bsc, arbitrum, polygon' },
      },
    },
    deliverable: {
      type: 'object',
      properties: {
        risk: { type: 'object' },
        token: { type: 'object' },
        contract: { type: 'object' },
        technical: { type: 'object' },
        verdict: { type: 'string' },
      },
    },
  },
];

/**
 * Generate the JSON file for import into Virtuals dashboard.
 */
export function generateOfferingsJSON(): object[] {
  return TOKEN_OFFERINGS.map((o) => ({
    name: o.name,
    description: o.description,
    price: o.price,
    priceV2: { type: 'fixed', value: o.price },
    slaMinutes: o.slaMinutes,
    requirement: JSON.stringify(o.requirement),
    deliverable: JSON.stringify(o.deliverable),
  }));
}

# Unified Token Risk Analysis Agent: Deep Research Report
## Product Specification for the Virtuals Protocol ACP Ecosystem

**Date:** March 23, 2026
**Data Sources:** 1,000 job log entries (pages 1-10), 8 competitor agent profiles, free API documentation

---

## SECTION 1: COMPETITIVE LANDSCAPE — CURRENT RISK ANALYSIS PROVIDERS

### Provider Profiles (Complete)

#### 1. BlackSwan (Agent #802)
- **Status:** Online (0 min since last active)
- **Success Rate:** 90.52% (1,261 successful / 3,709 total)
- **Unique Buyers:** 122
- **Revenue:** $22.51
- **Rating:** 4.91/5
- **Wallet Balance:** 16.35 USDC

| Offering | Price | Description | SLA |
|----------|-------|-------------|-----|
| **Flare** | $0.01 | Detects precursor risk signals before events materialize. Targets exploits, regulatory actions, market anomalies. | 5 min |
| **Core** | $0.03 | Comprehensive risk environment assessment. Synthesizes market conditions, sentiment, and positioning. | 5 min |

**What it actually does:** BlackSwan monitors prediction markets, social signals, derivatives data, and news. Its "Flare" offering is an early-warning system focused on macro/event risk rather than token-specific contract analysis. It detects when something is ABOUT to go wrong (exploit rumors, regulatory signals, unusual derivatives positioning). "Core" provides a broader risk landscape assessment. This is more macro risk intelligence than token-level safety scanning.

**Key buyers:** BaseTradeBot (6615), DeFi Auditor (6693), PhishingDetector (6796), TradeBuddy (6463), WalletSecurityScanner (6793)

---

#### 2. Wolfpack Intelligence (Agent #1888)
- **Status:** Online
- **Success Rate:** 77.56% (2,088 successful / 5,585 total)
- **Unique Buyers:** 51
- **Revenue:** $210.26 (highest revenue among risk providers)
- **Rating:** 4.97/5
- **Wallet Balance:** 122.38 USDC

| Offering | Price | Description | SLA |
|----------|-------|-------------|-----|
| **Token Risk Analysis** | $0.02 | Composite risk scoring (0-100) analyzing liquidity, holder concentration, smart money activity, and contract security. Outputs: risk level, recommendation, honeypot detection, verification status. | 5 min |
| **Quick Security Check** | $0.01 | Sub-second GoPlus screening for honeypot, tax rates, proxy contracts, owner privileges. Fast go/no-go assessment. | 5 min |
| **Narrative Momentum Score** | $0.05 | Agent-native social sentiment analysis with momentum scoring (0-100). Tracks social velocity and emerging trends. | 5 min |

**What it actually does:** Wolfpack is the most comprehensive single-provider risk solution currently available. Token Risk Analysis combines on-chain liquidity checks, holder concentration analysis, smart money tracking, and contract security into a 0-100 risk score. Quick Security Check is explicitly a GoPlus API wrapper providing sub-second honeypot/tax screening. Narrative Momentum Score adds a social sentiment dimension.

**Key insight:** Wolfpack's Quick Security Check is literally just a GoPlus API call being resold for $0.01. This is the exact value we can replicate for free.

**Key buyers:** BaseTradeBot (6615), Butler (human)

---

#### 3. TokenSense (Agent #1320)
- **Status:** Online (0 min since last active)
- **Success Rate:** 86.81% (1,244 successful / 3,710 total)
- **Unique Buyers:** 38
- **Revenue:** $12.66

| Offering | Price | Description | SLA |
|----------|-------|-------------|-----|
| **wachInternal** | $0.01 | Comprehensive token security audit: static code inspection, behavioral simulation, on-chain intelligence. Detects rug-pull mechanics, stealth taxes, honeypots, liquidity manipulation. | 6 min |

**What it actually does:** TokenSense is a worker agent for the WachAI router system. When WachAI receives a token verification request, it routes the actual analysis work to TokenSense (and potentially other workers). The "wachInternal" offering is not meant to be called directly by end-user agents -- it is an internal routing mechanism. TokenSense performs AI-powered smart contract code analysis, going deeper than simple API checks: it does static inspection of Solidity source code, behavioral simulation, and cross-references on-chain intelligence.

**Key buyers:** CryptoORI (5183), DealMaker (via WachAI routing)

---

#### 4. RugRadar (Agent #4035)
- **Status:** Online
- **Success Rate:** 55.56% (70 successful / 211 total) -- WORST in category
- **Unique Buyers:** 10
- **Revenue:** $4.04

| Offering | Price | Description | SLA |
|----------|-------|-------------|-----|
| **Quick Scan** | $0.02 | GoPlus Security API (30+ checks) + DexScreener data. Returns risk score (0-100), risk level, detected flags, market data. Response under 2 seconds. Chains: Base, Ethereum, BSC, Solana. | 5 min |
| **Deep Scan** | $0.20 | Contract source code analysis: delegatecall/selfdestruct patterns, deployer history, holder concentration. Detailed risk report with trust scores. Chains: Base, Ethereum, BSC. | 5 min |
| **Deployer Check** | $0.05 | Wallet reputation analysis: trust score (0-100), deployment history, rugpull count. Chains: Base, Ethereum, BSC, Solana. | 5 min |

**What it actually does:** RugRadar is architecturally similar to what we want to build. Quick Scan combines GoPlus (30+ checks) with DexScreener for a combined risk score. Deep Scan adds source code analysis. Deployer Check adds wallet reputation. However, its 55.56% success rate is catastrophic -- nearly half of all requests fail. This is the clearest example of an opportunity: the product design is right, the execution is terrible.

**Key buyers:** DeFi Auditor (6693)

---

#### 5. HiveFury Sentinel (Agent #1229)
- **Status:** Online
- **Success Rate:** 93.14% (1,723 successful / 5,040 total) -- BEST reliability
- **Unique Buyers:** 181 (MOST buyers in category)
- **Revenue:** $17.97
- **Rating:** 4.58/5

| Offering | Price | Description | SLA |
|----------|-------|-------------|-----|
| **Contract Safety Check** | $0.01 | Identifies vulnerabilities and malicious patterns. Safety score (0-100). | 5 min |
| **Token Verification** | $0.01 | Honeypot detection, liquidity analysis, trust scoring. Base network focus. | 5 min |
| **Transaction Risk Assessment** | $0.01 | Pre-execution analysis detecting phishing and malicious approvals. | 5 min |
| **URL Threat Scan** | $0.01 | Domain reputation and malware detection with risk classification. | 5 min |
| **Protect Transaction** | $0.02 | Multi-layer security combining all scanning capabilities. | 5 min |
| **Assess Agent Trust** | $0.01 | OSINT verification for agent wallets and domains. | 30 min |

**What it actually does:** HiveFury is the broadest security provider. Its 6 offerings cover the full security spectrum: smart contract analysis, token honeypot detection, transaction-level phishing detection, URL/domain threat scanning, combined protection bundles, and even agent trust assessment via OSINT. The URL Threat Scan is unique in the ecosystem -- no other risk provider offers domain/URL scanning. Transaction Risk Assessment is also unique: it evaluates a specific transaction BEFORE execution, checking for malicious approvals, phishing, etc.

**Key buyers:** DealMaker, PhishingDetector (6796) -- HiveFury has the MOST unique buyers (181) of any risk provider, suggesting broad adoption across the ecosystem.

---

#### 6. VerdictSwarm (Agent #21032)
- **Status:** Online
- **Success Rate:** 97.67% (42 successful / 252 total) -- HIGHEST success rate but tiny volume
- **Unique Buyers:** 1
- **Revenue:** $0.42

| Offering | Price | Description | SLA |
|----------|-------|-------------|-----|
| **Token Security Analysis** | $0.01 | Adversarial AI consensus analysis. Uses 6 adversarial AI agents to evaluate contracts, liquidity, team, tokenomics, community, and risk factors. Returns score (0-100), letter grade (A-F), risk level, agent verdicts, and detailed report URL. | 5 min |

**What it actually does:** VerdictSwarm has the most sophisticated methodology: 6 independent AI agents each analyze a different dimension of a token (contract code, liquidity, team background, tokenomics, community health, overall risk), then reach consensus. This adversarial approach should theoretically catch things any single analysis would miss. However, it has only 1 buyer (VS-TestBuyer, which is its own test agent, #21099), suggesting it has not achieved product-market fit despite strong technical design.

**Key insight:** VerdictSwarm's approach of multi-agent adversarial analysis is methodologically sound but commercially unsuccessful. The lesson: methodology alone does not win -- distribution and reliability matter more.

---

#### 7. Mochi (Agent #10027)
- **Status:** Online
- **Success Rate:** 75.92% (4,366 successful / 13,031 total)
- **Unique Buyers:** 92
- **Revenue:** $55.37

| Key Offerings (from 45 total) | Price | Description |
|-------------------------------|-------|-------------|
| **token_safety** | $0.025 | Comprehensive token risk evaluation via GoPlus API |
| **honeypot_check** | $0.02 | Quick honeypot detection: YES/NO verdict |
| **rug_score** | $0.03 | Composite risk: mintability, LP concentration, creator signals |
| **risk_report** | $0.03 | Unified security assessment across multiple factors |
| **wallet_risk** | $0.02 | Address blacklist and phishing detection |
| **contract_scan** | $0.025 | Source code analysis for dangerous functions |
| **quick_safety** | $0.02 | Ultra-fast combined safety check, traffic-light verdicts |
| **token_pair_check** | $0.03 | Dual-token trading pair evaluation |

**What it actually does:** Mochi is a "Swiss Army knife" with 45 separate offerings spanning security, contract data, and token info. Many of these are GoPlus API wrappers (token_safety, honeypot_check) similar to Wolfpack's Quick Security Check. The breadth is impressive but the 75.92% success rate indicates quality issues. Having 45 separate skills creates a confusing user experience -- buyers must know exactly which of the 45 offerings to call.

**Key insight:** Mochi's 45-skill approach is the anti-pattern. Buyers want ONE call, not a menu of 45 options to navigate.

**Chains:** Ethereum, Base, BSC, Polygon, Arbitrum

---

#### 8. WachAI (Agent #153)
- **Status:** Online (0 min since last active)
- **Success Rate:** 84.20% (5,538 successful / 16,620 total)
- **Unique Buyers:** 365 (HIGHEST in entire risk category)
- **Revenue:** $5,542.70 (DOMINANT revenue leader -- 16x the next competitor)
- **Rating:** 4.66/5

| Offering | Price | Description | SLA |
|----------|-------|-------------|-----|
| **verify_token** | $1.00 | Token honeypot, rug-pull, hidden privileges, liquidity analysis. Multi-chain. | 30 min |
| **verify_ticker** | $1.00 | Same as verify_token but accepts ticker symbol instead of contract address. | 30 min |
| **token_information** | $1.00 | Standardized token profiles: contract data, market metrics, liquidity. | 30 min |
| **audit_contract** | $0.01 | Full smart contract security audit using AI code analysis. Restricted access. | 30 min |

**What it actually does:** WachAI positions itself as "The Security Layer of ACP." It is the ecosystem's dominant risk provider by revenue ($5,542.70) and unique buyers (365). However, it charges $1.00 per call -- 50-100x more than competitors. Its 30-minute SLA is also 6x slower than competitors' 5-minute SLAs. WachAI routes work to sub-agents like TokenSense (#1320) for actual analysis. It is effectively a router/orchestrator that charges a premium for brand trust.

**Key insight:** WachAI proves that the market WILL pay for token risk analysis. $5,542 in revenue with 365 buyers is significant. But at $1.00/call with 30-min SLA, there is enormous room to undercut on both price and speed while maintaining quality. WachAI's revenue is roughly 80% of ALL risk analysis revenue in the ecosystem combined.

---

### Competitive Landscape Summary

| Provider | Success % | Buyers | Revenue | Price Range | Speed | Unique Signal |
|----------|-----------|--------|---------|-------------|-------|---------------|
| **WachAI** | 84.2% | 365 | $5,542.70 | $0.01-$1.00 | 30 min | AI code audit, brand trust |
| **Wolfpack** | 77.6% | 51 | $210.26 | $0.01-$0.05 | 5 min | Smart money tracking, narrative momentum |
| **Mochi** | 75.9% | 92 | $55.37 | $0.02-$0.03 | 5 min | 45 skills breadth, multi-chain |
| **BlackSwan** | 90.5% | 122 | $22.51 | $0.01-$0.03 | 5 min | Macro event risk, prediction markets |
| **HiveFury** | 93.1% | 181 | $17.97 | $0.01-$0.02 | 5 min | URL scanning, transaction-level phishing |
| **TokenSense** | 86.8% | 38 | $12.66 | $0.01 | 6 min | Deep source code analysis (WachAI sub-agent) |
| **RugRadar** | 55.6% | 10 | $4.04 | $0.02-$0.20 | 5 min | Deployer reputation, multi-chain |
| **VerdictSwarm** | 97.7% | 1 | $0.42 | $0.01 | 5 min | 6-agent adversarial consensus |

**Total addressable market (current):** ~$5,866 in recorded revenue across all risk providers. WachAI captures 94.5% of this.

---

## SECTION 2: BUYER AGENT ANALYSIS — WHO IS BUYING RISK SERVICES

### Active Buyers Identified (from job log analysis, pages 1-10)

| Buyer Agent | ID | Type | Providers Called | Services Used | Frequency |
|-------------|-----|------|-----------------|---------------|-----------|
| **BaseTradeBot** | 6615 | Trading bot | BlackSwan, Wolfpack | Flare, Token Risk Analysis | Very High -- multiple calls per hour |
| **DeFi Auditor** | 6693 | Security auditor | BlackSwan, RugRadar | Core, Quick Scan | Very High -- calls both providers |
| **PhishingDetector** | 6796 | Security scanner | BlackSwan, HiveFury | Flare, URL Threat Scan | High |
| **CryptoORI** | 5183 | Trading/research | TokenSense | wachInternal | High -- recurring |
| **TradeBuddy** | 6463 | Trading assistant | BlackSwan | Flare | High |
| **WalletSecurityScanner** | 6793 | Wallet security | BlackSwan | Flare | High |
| **DealMaker** | - | Security/deals | HiveFury (5 offerings), TokenSense | URL Scan, Agent Trust, Transaction Risk, Contract Safety, Token Verification, wachInternal | Very High -- calls 5 HiveFury services in sequence |
| **VS-TestBuyer** | 21099 | Test agent | VerdictSwarm | Token Security Analysis | Medium (testing) |
| **Butler** | - | Human router | Wolfpack, WachAI | Token Risk Analysis, verify_token | High |

### Critical Finding: Redundant Multi-Provider Calls

From page 9 of the job log (the richest sample for risk services), we can observe these patterns within a ~10-minute window:

**Pattern 1: BaseTradeBot calls TWO risk providers for the same trade decision**
- 00:01:37 - BlackSwan: Check Swap Risk ($0.01)
- 00:01:40 - BlackSwan: Assess Pre-trade Swap Risk ($0.01)
- 00:01:47 - Wolfpack: Analyze Token Risk ($0.02)
- 00:01:50 - Wolfpack: Analyze Token Risk ($0.02)
- 00:02:11 - BlackSwan: Check Swap Risk ($0.01)
- 00:02:14 - BlackSwan: Check Swap Risk ($0.01)
- 00:02:23 - Wolfpack: Analyze Token Risk ($0.02)
- 00:02:26 - Wolfpack: Analyze Token Risk ($0.02)

**Cost per trade decision:** $0.03-$0.06 (calling both BlackSwan + Wolfpack)
**Our opportunity:** Replace both calls with a single $0.03 call that provides MORE data.

**Pattern 2: DeFi Auditor calls BlackSwan + RugRadar**
- 00:01:57 - BlackSwan: Provide Risk Intelligence ($0.03)
- 00:01:59 - BlackSwan: Detect Agent Risk ($0.03)
- 00:02:35 - BlackSwan: Detect Risk ($0.03)
- 00:02:37 - BlackSwan: Query Risk Context ($0.03)
- 00:02:47 - RugRadar: Assess Token Safety ($0.02)
- 00:02:51 - RugRadar: Quick Scan Token Safety ($0.02)

**Cost per audit:** $0.16 (4 BlackSwan calls + 2 RugRadar calls)
**Our opportunity:** One call at $0.05 replaces 6 calls worth $0.16.

**Pattern 3: DealMaker calls 5 different HiveFury offerings sequentially**
- 00:08:09 - HiveFury: Detect Contract Threats ($0.01)
- 00:08:11 - HiveFury: Verify Token Security ($0.01)
- 00:09:01 - HiveFury: Scan URL Threats ($0.01)
- 00:09:03 - HiveFury: Assess Agent Trust ($0.01)
- 00:09:07 - HiveFury: Detect Transaction Risk ($0.01)

**Cost per security sweep:** $0.05 (5 separate calls to one provider)
**Our opportunity:** One call at $0.03 that bundles all checks.

### Estimated Total Spend on Risk Services

Based on the provider revenue data:
- WachAI: $5,542.70
- Wolfpack: $210.26
- Mochi: $55.37
- BlackSwan: $22.51
- HiveFury: $17.97
- TokenSense: $12.66
- RugRadar: $4.04
- VerdictSwarm: $0.42

**Total recorded risk service revenue: $5,865.93**

This is a lower bound. The ecosystem is at 2,277,313 total jobs and growing. If 4% are risk-related (per our sampling), that is ~91,000 risk service calls to date.

---

## SECTION 3: FREE DATA SOURCES AVAILABLE FOR AGGREGATION

### 1. GoPlus Security API (FREE)
**Endpoint:** `GET https://api.gopluslabs.io/api/v1/token_security/{chain_id}?contract_addresses={address}`

**Base chain_id:** 8453

**Checks included (30+ signals):**
- Honeypot detection (can_buy, can_sell)
- Buy/sell tax rates
- Proxy contract detection
- Ownership capabilities and renouncement
- Mint function availability
- Self-destruct functionality
- Anti-whale mechanisms
- Trading cooldown periods
- Transfer pausability
- Blacklist/whitelist functions
- Personal slippage modification
- Hidden owner detection
- Ownership takeback functions
- External contract calls
- Top 10 holder analysis with percentages
- Creator/owner token distribution
- LP holder information (V3/V4 details)
- Lock status and timing
- Open source verification status
- Fake token detection
- Airdrop scam detection

**Rate limits:** Free tier available without authentication. Generous limits for automated usage.

**Competitive note:** Wolfpack's "Quick Security Check" ($0.01) and RugRadar's "Quick Scan" ($0.02) are both GoPlus wrappers. This is literally free data being resold.

### 2. DexScreener API (FREE)
**Endpoints:**
- `GET /token-pairs/v1/{chainId}/{tokenAddress}` -- All trading pairs for a token
- `GET /latest/dex/pairs/{chainId}/{pairId}` -- Specific pair data
- `GET /latest/dex/search?q={query}` -- Search pairs
- `GET /tokens/v1/{chainId}/{tokenAddresses}` -- Batch token data

**Data returned:**
- Liquidity (USD value in pool)
- 24h trading volume
- Price and price change (5m, 1h, 6h, 24h)
- Pair creation timestamp (age of token)
- DEX identifier
- Number of transactions (buys/sells)
- Market cap (if available)

**Rate limits:** 60 requests/minute on some endpoints. No auth required.

**Key signals we derive:**
- Liquidity depth (is there enough to trade?)
- Volume/liquidity ratio (suspicious if extremely high or low)
- Token age (new = higher risk)
- Buy/sell ratio (one-sided = potential manipulation)
- Price volatility (extreme moves = risk)

### 3. Basescan/Etherscan API (FREE tier)
**Base URL:** `https://api.basescan.org/api`

**Endpoints:**
- Contract source code verification status
- Contract ABI retrieval
- Transaction history for addresses
- Token holder lists
- Internal transactions

**Key signals we derive:**
- Is the contract verified? (unverified = red flag)
- Contract source code available for analysis
- Deployer wallet activity history
- Contract creation timestamp

**Rate limits:** 5 calls/sec on free tier. API key required (free to obtain).

### 4. On-Chain Data via Base RPC (FREE)
**Public RPC:** `https://mainnet.base.org`

**Data available:**
- Token holder count and distribution (via Transfer event logs)
- Top holder balances
- Contract bytecode (for unverified contracts)
- Token total supply vs circulating supply
- Recent transfer patterns

**Key signals we derive:**
- Holder concentration (top 10 holders owning >80% = rug risk)
- Whale activity (large transfers = potential dump)
- Distribution pattern (few holders = illiquid)

### 5. Social Signals (FREE / Low-Cost)
**Sources:**
- Twitter/X API: Follower count, engagement rate, account age
- CoinGecko API (free tier): Community scores, developer activity
- Token metadata: Website existence, social links presence

**Key signals we derive:**
- Does the project have a real online presence?
- Is social engagement organic or botted?
- Developer activity indicators

---

## SECTION 4: PRODUCT SPECIFICATION — UNIFIED TOKEN RISK ANALYSIS

### Offering Name: `token_risk_scan`

### Input Specification

```json
{
  "token_address": "0x...",
  "chain": "base",
  "context": "pre_trade"
}
```

**Required fields:**
- `token_address` (string): The token contract address to analyze
- `chain` (string): "base" (initially), expandable to "ethereum", "bsc", "arbitrum", "polygon", "solana"

**Optional fields:**
- `context` (string): "pre_trade" (default), "portfolio_review", "deep_audit" -- adjusts depth of analysis
- `include_social` (boolean): Whether to include social signal analysis (adds ~2s latency)

### Output Specification

```json
{
  "token_address": "0x6CBeE386E6E50A5878375169868F01666810b62B",
  "chain": "base",
  "timestamp": "2026-03-23T06:00:00Z",
  "overall_risk_score": 35,
  "risk_level": "MEDIUM",
  "recommendation": "PROCEED_WITH_CAUTION",
  "verdict": "Token shows moderate risk. Contract is verified and not a honeypot, but holder concentration is high (top 10 hold 72%) and liquidity is thin ($12,400). Suitable for small positions only.",

  "contract_security": {
    "score": 20,
    "is_honeypot": false,
    "is_verified": true,
    "is_open_source": true,
    "has_proxy": false,
    "has_mint_function": true,
    "can_self_destruct": false,
    "owner_can_change_balance": false,
    "has_blacklist": false,
    "has_whitelist": false,
    "has_trading_cooldown": false,
    "can_pause_trading": false,
    "buy_tax": 0.0,
    "sell_tax": 2.5,
    "is_anti_whale": false,
    "hidden_owner": false,
    "can_take_back_ownership": false,
    "external_calls": false,
    "flags": ["has_mint_function", "sell_tax_2.5%"]
  },

  "liquidity_analysis": {
    "score": 45,
    "total_liquidity_usd": 12400,
    "volume_24h_usd": 8900,
    "volume_liquidity_ratio": 0.72,
    "pair_count": 2,
    "primary_dex": "uniswap_v3",
    "lp_locked": true,
    "lp_lock_duration_days": 180,
    "token_age_hours": 672,
    "flags": ["thin_liquidity", "single_dex_dependency"]
  },

  "holder_analysis": {
    "score": 55,
    "total_holders": 234,
    "top_10_concentration": 72.3,
    "top_holder_percentage": 28.1,
    "creator_holds_percentage": 5.2,
    "is_creator_top_holder": false,
    "flags": ["high_concentration", "low_holder_count"]
  },

  "market_signals": {
    "score": 25,
    "price_change_1h": -2.1,
    "price_change_24h": 15.3,
    "buy_sell_ratio_1h": 1.4,
    "market_cap_usd": 89000,
    "flags": []
  },

  "deployer_reputation": {
    "score": 30,
    "deployer_address": "0x...",
    "total_deployments": 12,
    "known_rugs": 0,
    "deployer_age_days": 45,
    "flags": ["prolific_deployer"]
  },

  "social_signals": {
    "score": 50,
    "has_website": true,
    "has_twitter": true,
    "twitter_followers": 1200,
    "twitter_account_age_days": 30,
    "has_telegram": false,
    "flags": ["no_telegram", "young_twitter"]
  },

  "data_sources": ["goplus", "dexscreener", "basescan", "rpc_onchain"],
  "analysis_time_ms": 1200
}
```

### Scoring Algorithm

Each dimension scores 0-100 (0 = safest, 100 = most dangerous):

**Contract Security Score (weight: 35%)**
- Honeypot detected: +100
- Not verified/open-source: +30
- Has proxy: +15
- Has mint function: +10
- Can self-destruct: +40
- Owner can change balance: +50
- Has blacklist: +10
- Can pause trading: +20
- Buy tax > 5%: +20, > 10%: +50
- Sell tax > 5%: +20, > 10%: +50
- Hidden owner: +30
- External calls detected: +15

**Liquidity Score (weight: 25%)**
- Liquidity < $1,000: +80
- Liquidity < $10,000: +40
- Liquidity < $50,000: +15
- Volume/Liquidity ratio > 5: +30 (wash trading signal)
- LP not locked: +25
- Token age < 24 hours: +30
- Token age < 7 days: +15
- Single DEX dependency: +10

**Holder Score (weight: 20%)**
- Top 10 hold > 90%: +70
- Top 10 hold > 70%: +40
- Top 10 hold > 50%: +15
- Total holders < 50: +40
- Total holders < 200: +15
- Creator is top holder: +20
- Creator holds > 20%: +30

**Deployer Reputation (weight: 10%)**
- Known rug pulls > 0: +80
- Deployer age < 7 days: +30
- More than 20 deployments: +15 (token factory pattern)

**Market Signals (weight: 10%)**
- Price drop > 50% in 24h: +50
- Buy/sell ratio < 0.3 or > 3.0: +25 (one-sided market)
- Market cap < $10,000: +20

**Overall Score = Weighted average, capped at 100**

**Risk Levels:**
- 0-20: LOW -- "Safe to trade"
- 21-40: MEDIUM -- "Proceed with caution"
- 41-60: HIGH -- "Significant risk detected"
- 61-80: CRITICAL -- "Strong rug/scam indicators"
- 81-100: EXTREME -- "Almost certainly malicious"

**Recommendations:**
- 0-20: `SAFE_TO_TRADE`
- 21-40: `PROCEED_WITH_CAUTION`
- 41-60: `REDUCE_POSITION_SIZE`
- 61-80: `AVOID`
- 81-100: `DO_NOT_TRADE`

### Pricing

| Tier | Price | What You Get | Target Latency |
|------|-------|--------------|----------------|
| **Standard** (primary offering) | $0.02 | Full scan: contract security + liquidity + holders + market signals + deployer reputation | < 3 seconds |
| **With Social** (optional upsell) | $0.03 | Standard + social signal analysis | < 5 seconds |

**Price rationale:**
- Undercuts WachAI by 97% ($0.02 vs $1.00)
- Matches or slightly undercuts Wolfpack ($0.02 vs $0.02) while providing MORE data
- Provides more data than RugRadar Quick Scan ($0.02) with far better reliability
- Cheaper than calling BlackSwan + Wolfpack separately ($0.03-$0.06 for both)
- Competitive with Mochi's individual checks ($0.02-$0.03 each, and buyers need multiple)
- Cheaper than calling HiveFury's 5 services separately ($0.05)

### SLA

- **Target response time:** < 3 seconds for Standard, < 5 seconds for With Social
- **SLA commitment:** 5 minutes (matching ecosystem standard)
- **Target success rate:** > 97% (beating every competitor except VerdictSwarm's unproven 97.7%)
- **Uptime target:** 99.9% (always online -- unlike Capminal's lesson)

### Architecture

```
Incoming ACP Request
        |
        v
  [Input Validation]
        |
        v
  [Parallel API Calls] -----> GoPlus Security API (contract checks)
        |                |---> DexScreener API (liquidity/market data)
        |                |---> Basescan API (contract verification, deployer history)
        |                |---> Base RPC (holder distribution, on-chain data)
        |                |---> (Optional) Social APIs
        |
        v
  [Response Aggregation]
        |
        v
  [Scoring Engine] -- weighted scoring algorithm
        |
        v
  [Verdict Generation] -- LLM generates human-readable verdict string
        |
        v
  [ACP Response] -- structured JSON returned to buyer agent
```

**Key design decisions:**
1. All API calls are made in parallel (not sequential) to minimize latency
2. If any single API fails, the scan still completes with available data (graceful degradation)
3. Scoring is deterministic (same inputs = same score) -- no LLM in the scoring loop
4. LLM is only used for the `verdict` string (natural language explanation)
5. Results are cached for 5 minutes (same token + same chain = cached response)

---

## SECTION 5: COMPETITIVE ANALYSIS — WHY US?

### Why would an agent use us instead of calling BlackSwan + Wolfpack + WachAI separately?

**1. Cost advantage**

| Scenario | Current Cost | Our Cost | Savings |
|----------|-------------|----------|---------|
| BaseTradeBot's typical pre-trade check (BlackSwan Flare + Wolfpack Token Risk) | $0.03 | $0.02 | 33% |
| DeFi Auditor's typical audit (4x BlackSwan + 2x RugRadar) | $0.16 | $0.02 | 87% |
| DealMaker's security sweep (5x HiveFury) | $0.05 | $0.02 | 60% |
| WachAI verify_token | $1.00 | $0.02 | 98% |
| Mochi token_safety + honeypot_check + rug_score | $0.075 | $0.02 | 73% |

**Average cost savings: 70%+ for multi-call patterns.**

**2. Speed advantage**

| Provider | SLA | Typical Response |
|----------|-----|-----------------|
| WachAI | 30 minutes | Minutes |
| BlackSwan | 5 minutes | Seconds |
| Wolfpack | 5 minutes | Sub-second (Quick) to seconds |
| HiveFury | 5-30 minutes | Seconds |
| **Us** | **5 minutes** | **< 3 seconds** |

We match the fastest providers while providing more data. WachAI's 30-minute SLA is a dealbreaker for pre-trade decisions.

**3. Reliability advantage**

| Provider | Success Rate |
|----------|-------------|
| RugRadar | 55.56% |
| Mochi | 75.92% |
| Wolfpack | 77.56% |
| WachAI | 84.20% |
| TokenSense | 86.81% |
| BlackSwan | 90.52% |
| HiveFury | 93.14% |
| VerdictSwarm | 97.67% (tiny sample) |
| **Us (target)** | **> 97%** |

Our architecture of parallel API calls with graceful degradation means we can still return a result even if one data source fails. Competitors that depend on a single API (e.g., GoPlus wrapper) fail entirely when that API is down.

**4. Data completeness advantage**

| Signal | BlackSwan | Wolfpack | RugRadar | HiveFury | Mochi | WachAI | **Us** |
|--------|-----------|----------|----------|----------|-------|--------|--------|
| Honeypot detection | - | YES | YES | YES | YES | YES | **YES** |
| Contract audit | - | Partial | YES | YES | Partial | YES | **YES** |
| Liquidity depth | - | YES | YES | - | - | YES | **YES** |
| Holder concentration | - | YES | YES | - | - | - | **YES** |
| Deployer reputation | - | - | YES | - | - | - | **YES** |
| Buy/sell tax rates | - | YES | YES | - | YES | YES | **YES** |
| Market data (price, volume) | - | - | YES | - | - | YES | **YES** |
| Smart money tracking | - | YES | - | - | - | - | No |
| Social sentiment | - | YES | - | - | - | - | **YES (optional)** |
| URL/domain scanning | - | - | - | YES | - | - | No |
| Transaction-level phishing | - | - | - | YES | - | - | No |
| Macro event risk | YES | - | - | - | - | - | No |
| Prediction market signals | YES | - | - | - | - | - | No |

**We cover 10 of 13 signal categories in a single call.** The 3 we don't cover (smart money, URL scanning, macro risk) are specialized signals that most pre-trade decisions don't need. Smart money tracking could be added later via on-chain analysis.

**5. Simplicity advantage**

- **Mochi:** 45 different offerings to choose from. Buyer must know which to call.
- **HiveFury:** 6 offerings. Buyer must call multiple for full coverage.
- **BlackSwan:** 2 offerings, but provides macro risk, not token-specific safety.
- **Us:** ONE call. One input. One comprehensive output. No decision paralysis.

### Unique Signals We Could Add That Nobody Else Offers

1. **Cross-reference scoring**: Compare the token against known rug-pull patterns in our database. As we process more tokens, we build a dataset of confirmed rugs and their pre-rug characteristics. No competitor maintains this.

2. **Deployer wallet network analysis**: Not just "has this deployer rugged before?" but "is this deployer connected to known rug deployers via on-chain fund flows?" Uses Basescan transaction history to map deployer networks.

3. **Liquidity trajectory**: Not just current liquidity, but is liquidity increasing or decreasing over the last 24h? A token losing liquidity is a leading indicator of a rug pull. We can derive this from DexScreener historical data.

4. **Holder velocity**: Are holders increasing or decreasing? A token losing holders while price rises is a red flag (distribution phase). Derivable from on-chain Transfer events.

5. **Contract similarity scoring**: Compare the token's bytecode against known scam contract templates. Many rug pulls use the same factory contracts with minor modifications. We can build a fingerprint database.

6. **Aggregate confidence score**: Since we pull from 4+ independent data sources, we can report HOW MUCH the sources agree. If GoPlus says safe but holder analysis says dangerous, that disagreement itself is a signal.

---

## SECTION 6: GO-TO-MARKET STRATEGY

### Phase 1: Launch (Week 1-2)

**Target:** Capture BaseTradeBot and DeFi Auditor as first customers.

**Actions:**
1. Register agent on ACP with offering `token_risk_scan` at $0.02
2. Achieve >97% success rate in testing
3. Publish to the ACP marketplace
4. BaseTradeBot currently calls BlackSwan ($0.01) + Wolfpack ($0.02) = $0.03 per trade decision. We offer the same for $0.02 with more data. Direct cost savings pitch.

**Success metric:** 100 successful jobs in first week.

### Phase 2: Establish Reliability (Week 3-4)

**Target:** Build track record that demonstrates >97% success rate and <3s response time.

**Actions:**
1. Monitor and optimize API call patterns
2. Implement caching layer for frequently-checked tokens
3. Add response time metrics to output (transparency builds trust)
4. Begin building deployer reputation database from processed tokens

**Success metric:** 500+ successful jobs, >97% success rate visible on ACP dashboard.

### Phase 3: Capture WachAI's Market (Month 2-3)

**Target:** WachAI's 365 buyers who pay $1.00/call.

**Value proposition:** Same or better analysis, 98% cheaper, 10x faster.

**Actions:**
1. Target Butler/human users who currently call WachAI
2. Add the `include_social` option to match WachAI's breadth
3. Consider a "verify_ticker" convenience offering (lookup by ticker symbol, like WachAI)
4. Leverage AgentCheck integration to surface our reliability metrics

**Success metric:** 50+ unique buyers, matching Wolfpack's buyer count.

### Phase 4: Platform Play (Month 3-6)

**Target:** Become the default pre-trade risk layer that every trading agent integrates.

**Actions:**
1. Partner with Nox (trading execution) to offer bundled risk-check-then-trade flows
2. Build historical database of scanned tokens and outcomes (did flagged tokens actually rug?)
3. Publish a "Token Safety Index" leaderboard -- free marketing
4. Add multi-chain support (Ethereum, BSC, Arbitrum)
5. Offer volume discounts for agents making >100 calls/day

**Success metric:** 1,000+ unique buyers, >$500/month revenue.

### Revenue Projections

| Scenario | Monthly Calls | Price/Call | Monthly Revenue |
|----------|--------------|------------|-----------------|
| Conservative (capture 10% of risk market) | 9,100 | $0.02 | $182 |
| Moderate (capture 30% + growth) | 40,000 | $0.02 | $800 |
| Aggressive (become default + WachAI displacement) | 150,000 | $0.022 avg | $3,300 |
| Moonshot (ecosystem 10x growth + dominant position) | 500,000 | $0.025 avg | $12,500 |

**Break-even analysis:** At $0.02/call, the service is pure margin (all underlying data sources are free). Server costs for running the agent are the only expense. Break-even at ~100 calls/month.

---

## SECTION 7: RISKS AND MITIGATIONS

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| GoPlus API rate-limited or down | Medium | High | Graceful degradation: return partial results from other sources. Implement caching. |
| WachAI drops price to compete | Low | Medium | Our cost basis is near-zero (free APIs). We can always undercut. WachAI has sub-agent costs. |
| Existing providers bundle their offerings | Medium | Medium | First-mover advantage. Our architecture is inherently more efficient (parallel calls vs. sequential ACP calls). |
| False positive rate too high (flagging safe tokens) | Medium | High | Calibrate scoring weights using historical data. Allow buyer agents to set their own risk threshold. |
| New free alternative emerges | Low | Low | Network effects: our deployer reputation database and historical scan data become moats over time. |
| ACP ecosystem growth stalls | Medium | High | Diversify to non-ACP channels. The same API can serve direct HTTP clients. |

---

## SECTION 8: TECHNICAL IMPLEMENTATION NOTES

### Estimated Build Time: 2-3 days

**Day 1:** Core API integration
- GoPlus Security API integration
- DexScreener API integration
- Basescan API integration (contract verification + deployer history)
- Base RPC integration (holder distribution)
- Parallel execution framework

**Day 2:** Scoring and ACP integration
- Scoring algorithm implementation
- ACP agent registration and offering setup
- Response formatting and validation
- LLM integration for verdict generation

**Day 3:** Testing and hardening
- Test against known rug-pull tokens
- Test against known safe tokens
- Edge case handling (unverified contracts, new tokens, dead tokens)
- Caching layer
- Error handling and graceful degradation

### Technology Stack
- **Runtime:** Node.js/TypeScript (matching existing Thesis project)
- **APIs:** axios for HTTP calls
- **LLM:** Claude API for verdict generation (optional)
- **Database:** SQLite (via sql.js, already in project dependencies) for caching and deployer reputation
- **ACP:** Virtuals Protocol ACP SDK for agent registration

---

## APPENDIX: RAW DATA TABLES

### Provider Revenue Ranking (Risk Category Only)

| Rank | Provider | Revenue | Market Share |
|------|----------|---------|-------------|
| 1 | WachAI | $5,542.70 | 94.5% |
| 2 | Wolfpack Intelligence | $210.26 | 3.6% |
| 3 | Mochi | $55.37 | 0.9% |
| 4 | BlackSwan | $22.51 | 0.4% |
| 5 | HiveFury Sentinel | $17.97 | 0.3% |
| 6 | TokenSense | $12.66 | 0.2% |
| 7 | RugRadar | $4.04 | 0.1% |
| 8 | VerdictSwarm | $0.42 | 0.0% |
| **Total** | | **$5,865.93** | **100%** |

### Provider Success Rate Ranking

| Rank | Provider | Success Rate | Sample Size |
|------|----------|-------------|-------------|
| 1 | VerdictSwarm | 97.67% | 252 |
| 2 | HiveFury Sentinel | 93.14% | 5,040 |
| 3 | BlackSwan | 90.52% | 3,709 |
| 4 | TokenSense | 86.81% | 3,710 |
| 5 | WachAI | 84.20% | 16,620 |
| 6 | Wolfpack Intelligence | 77.56% | 5,585 |
| 7 | Mochi | 75.92% | 13,031 |
| 8 | RugRadar | 55.56% | 211 |

### Provider Unique Buyer Ranking

| Rank | Provider | Unique Buyers |
|------|----------|--------------|
| 1 | WachAI | 365 |
| 2 | HiveFury Sentinel | 181 |
| 3 | BlackSwan | 122 |
| 4 | Mochi | 92 |
| 5 | Wolfpack Intelligence | 51 |
| 6 | TokenSense | 38 |
| 7 | RugRadar | 10 |
| 8 | VerdictSwarm | 1 |

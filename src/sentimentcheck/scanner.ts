import axios from 'axios';
import { COINGECKO_API } from '../config/api-endpoints.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('sentiment-scanner');

export interface SentimentReport {
  token_address: string;
  chain: string;
  timestamp: string;
  scan_time_ms: number;
  sources_available: string[];
  sources_failed: string[];

  // Overall sentiment
  sentiment_score: number; // 0-100 (0=extremely bearish, 100=extremely bullish)
  sentiment_level: 'VERY_BEARISH' | 'BEARISH' | 'NEUTRAL' | 'BULLISH' | 'VERY_BULLISH';
  momentum: 'DECLINING' | 'STABLE' | 'GROWING' | 'SURGING';

  // Community metrics
  community: {
    score: number; // CoinGecko community_score
    reddit_subscribers: number;
    reddit_active_users_48h: number;
    reddit_posts_48h: number;
    telegram_users: number;
    has_social_links: boolean;
    social_link_count: number;
  };

  // Developer activity
  developer: {
    score: number; // CoinGecko developer_score
    github_stars: number;
    github_forks: number;
    commit_count_4_weeks: number;
    pull_requests_merged: number;
    contributors: number;
  };

  // Crowd sentiment
  crowd: {
    votes_up_pct: number;
    votes_down_pct: number;
    public_interest_score: number;
  };

  // Market fear & greed context
  market_context: {
    fear_greed_value: number;
    fear_greed_label: string;
  };

  // Red flags
  red_flags: string[];
  positive_signals: string[];

  verdict: string;
}

// Rate limiting for CoinGecko
let lastCGCall = 0;
const CG_MIN_INTERVAL = 2500;

async function rateLimitedCGGet(url: string, params?: Record<string, unknown>, timeout = 8000) {
  const wait = Math.max(0, CG_MIN_INTERVAL - (Date.now() - lastCGCall));
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastCGCall = Date.now();
  return axios.get(url, { params, timeout });
}

/**
 * Get full community/developer/sentiment data from CoinGecko.
 */
async function getCoinGeckoSocial(address: string, chain: string = 'base') {
  const platform = chain === 'base' ? 'base' : chain;
  const url = `${COINGECKO_API.baseUrl}/coins/${platform}/contract/${address.toLowerCase()}`;

  try {
    const resp = await rateLimitedCGGet(url);
    const d = resp.data;
    if (!d) return null;

    return {
      available: true,
      community_score: d.community_score ?? 0,
      developer_score: d.developer_score ?? 0,
      public_interest_score: d.public_interest_score ?? 0,
      sentiment_votes_up_pct: d.sentiment_votes_up_percentage ?? 50,
      sentiment_votes_down_pct: d.sentiment_votes_down_percentage ?? 50,
      reddit_subscribers: d.community_data?.reddit_subscribers ?? 0,
      reddit_active_users_48h: d.community_data?.reddit_accounts_active_48h ?? 0,
      reddit_posts_48h: d.community_data?.reddit_average_posts_48h ?? 0,
      reddit_comments_48h: d.community_data?.reddit_average_comments_48h ?? 0,
      telegram_users: d.community_data?.telegram_channel_user_count ?? 0,
      facebook_likes: d.community_data?.facebook_likes ?? 0,
      github_stars: d.developer_data?.stars ?? 0,
      github_forks: d.developer_data?.forks ?? 0,
      github_subscribers: d.developer_data?.subscribers ?? 0,
      commit_count_4_weeks: d.developer_data?.commit_count_4_weeks ?? 0,
      pull_requests_merged: d.developer_data?.pull_requests_merged ?? 0,
      contributors: d.developer_data?.pull_request_contributors ?? 0,
      total_issues: d.developer_data?.total_issues ?? 0,
      closed_issues: d.developer_data?.closed_issues ?? 0,
    };
  } catch (e) {
    log.warn(`CoinGecko social data unavailable: ${(e as Error)?.message}`);
    return null;
  }
}

/**
 * Check DexScreener for social link presence.
 */
async function getDexScreenerSocials(address: string, chain: string = 'base') {
  try {
    const resp = await axios.get(`https://api.dexscreener.com/token-profiles/latest/v1`, {
      timeout: 5000,
    });

    const profiles = resp.data ?? [];
    const match = profiles.find((p: Record<string, unknown>) =>
      (p.tokenAddress as string)?.toLowerCase() === address.toLowerCase() &&
      (p.chainId as string) === chain,
    );

    if (!match) return { available: false, hasLinks: false, linkCount: 0, links: [] };

    const links = (match.links ?? []) as { type: string; label: string; url: string }[];
    return {
      available: true,
      hasLinks: links.length > 0,
      linkCount: links.length,
      links: links.map((l) => ({ type: l.type, url: l.url })),
    };
  } catch {
    return { available: false, hasLinks: false, linkCount: 0, links: [] };
  }
}

/**
 * Get global Fear & Greed Index.
 */
async function getFearGreed(): Promise<{ value: number; label: string; available: boolean }> {
  try {
    const resp = await axios.get('https://api.alternative.me/fng/?limit=1', { timeout: 3000 });
    const data = resp.data?.data?.[0];
    if (!data) return { value: 50, label: 'Neutral', available: false };
    return {
      value: parseInt(data.value, 10),
      label: data.value_classification ?? 'Neutral',
      available: true,
    };
  } catch {
    return { value: 50, label: 'Neutral', available: false };
  }
}

/**
 * Compute sentiment score from all signals.
 */
function computeSentiment(
  cg: NonNullable<Awaited<ReturnType<typeof getCoinGeckoSocial>>>,
  dex: Awaited<ReturnType<typeof getDexScreenerSocials>>,
  fg: Awaited<ReturnType<typeof getFearGreed>>,
): { score: number; momentum: SentimentReport['momentum']; redFlags: string[]; positiveSignals: string[] } {
  let score = 50; // neutral baseline
  const redFlags: string[] = [];
  const positiveSignals: string[] = [];

  // Crowd sentiment (CoinGecko votes)
  if (cg.sentiment_votes_up_pct > 70) { score += 10; positiveSignals.push('strong_crowd_bullish'); }
  else if (cg.sentiment_votes_up_pct < 30) { score -= 10; redFlags.push('crowd_bearish'); }

  // Community score
  if (cg.community_score > 60) { score += 8; positiveSignals.push('strong_community'); }
  else if (cg.community_score > 30) { score += 3; }
  else if (cg.community_score === 0) { score -= 5; redFlags.push('no_community_data'); }

  // Reddit activity
  if (cg.reddit_subscribers > 50000) { score += 5; positiveSignals.push('large_reddit'); }
  if (cg.reddit_active_users_48h > 1000) { score += 3; positiveSignals.push('active_reddit'); }
  if (cg.reddit_posts_48h > 10) { score += 2; positiveSignals.push('reddit_discussion'); }

  // Telegram
  if (cg.telegram_users > 10000) { score += 5; positiveSignals.push('large_telegram'); }
  else if (cg.telegram_users > 1000) { score += 2; }

  // Developer activity
  if (cg.commit_count_4_weeks > 50) { score += 8; positiveSignals.push('active_development'); }
  else if (cg.commit_count_4_weeks > 10) { score += 4; positiveSignals.push('moderate_development'); }
  else if (cg.commit_count_4_weeks === 0 && cg.developer_score === 0) {
    score -= 3; redFlags.push('no_dev_activity');
  }

  if (cg.github_stars > 1000) { score += 3; positiveSignals.push('popular_repo'); }
  if (cg.contributors > 20) { score += 3; positiveSignals.push('diverse_contributors'); }

  // Social links (DexScreener)
  if (dex.available && !dex.hasLinks) {
    score -= 8; redFlags.push('no_social_links_on_dexscreener');
  } else if (dex.available && dex.linkCount >= 3) {
    score += 3; positiveSignals.push('multiple_social_links');
  }

  // Market context (Fear & Greed)
  // This adjusts the baseline — in extreme greed, be slightly more cautious
  if (fg.available) {
    if (fg.value > 80) { score -= 3; } // extreme greed = potential overvaluation
    else if (fg.value < 20) { score += 3; } // extreme fear = potential undervaluation
  }

  // Public interest
  if (cg.public_interest_score > 0.5) { score += 3; positiveSignals.push('high_public_interest'); }

  // Clamp
  score = Math.max(0, Math.min(100, score));

  // Momentum heuristic
  let momentum: SentimentReport['momentum'];
  if (cg.reddit_active_users_48h > 500 && cg.reddit_posts_48h > 5) {
    momentum = cg.sentiment_votes_up_pct > 60 ? 'SURGING' : 'GROWING';
  } else if (cg.reddit_active_users_48h > 100 || cg.telegram_users > 5000) {
    momentum = 'GROWING';
  } else if (cg.community_score > 20) {
    momentum = 'STABLE';
  } else {
    momentum = 'DECLINING';
  }

  return { score, momentum, redFlags, positiveSignals };
}

/**
 * Main scan function for SentimentCheck.
 */
export async function scanSentiment(
  tokenAddress: string,
  chain: string = 'base',
): Promise<SentimentReport> {
  const startTime = Date.now();
  const sourcesAvailable: string[] = [];
  const sourcesFailed: string[] = [];

  // Parallel fetch all data sources
  const [cgResult, dexResult, fgResult] = await Promise.allSettled([
    getCoinGeckoSocial(tokenAddress, chain),
    getDexScreenerSocials(tokenAddress, chain),
    getFearGreed(),
  ]);

  const cg = cgResult.status === 'fulfilled' ? cgResult.value : null;
  const dex = dexResult.status === 'fulfilled' ? dexResult.value : { available: false, hasLinks: false, linkCount: 0, links: [] };
  const fg = fgResult.status === 'fulfilled' ? fgResult.value : { value: 50, label: 'Neutral', available: false };

  if (cg?.available) sourcesAvailable.push('coingecko');
  else sourcesFailed.push('coingecko');
  if (dex.available) sourcesAvailable.push('dexscreener');
  else sourcesFailed.push('dexscreener');
  if (fg.available) sourcesAvailable.push('fear_greed');
  else sourcesFailed.push('fear_greed');

  // If no CoinGecko data, we can still provide basic results
  const defaultCG = {
    available: false,
    community_score: 0, developer_score: 0, public_interest_score: 0,
    sentiment_votes_up_pct: 50, sentiment_votes_down_pct: 50,
    reddit_subscribers: 0, reddit_active_users_48h: 0, reddit_posts_48h: 0, reddit_comments_48h: 0,
    telegram_users: 0, facebook_likes: 0,
    github_stars: 0, github_forks: 0, github_subscribers: 0,
    commit_count_4_weeks: 0, pull_requests_merged: 0, contributors: 0,
    total_issues: 0, closed_issues: 0,
  };

  const cgData = cg ?? defaultCG;
  const { score, momentum, redFlags, positiveSignals } = computeSentiment(cgData, dex, fg);

  // Determine level
  let level: SentimentReport['sentiment_level'];
  if (score >= 75) level = 'VERY_BULLISH';
  else if (score >= 60) level = 'BULLISH';
  else if (score >= 40) level = 'NEUTRAL';
  else if (score >= 25) level = 'BEARISH';
  else level = 'VERY_BEARISH';

  // Verdict
  let verdict: string;
  if (!cg?.available && !dex.available) {
    verdict = `No social data available for this token. This could indicate a very new or obscure project — proceed with caution.`;
  } else {
    const parts: string[] = [`Sentiment: ${level} (${score}/100). Momentum: ${momentum}.`];
    if (positiveSignals.length > 0) parts.push(`Positive: ${positiveSignals.slice(0, 3).join(', ')}.`);
    if (redFlags.length > 0) parts.push(`Concerns: ${redFlags.slice(0, 3).join(', ')}.`);
    verdict = parts.join(' ');
  }

  return {
    token_address: tokenAddress,
    chain,
    timestamp: new Date().toISOString(),
    scan_time_ms: Date.now() - startTime,
    sources_available: sourcesAvailable,
    sources_failed: sourcesFailed,
    sentiment_score: score,
    sentiment_level: level,
    momentum,
    community: {
      score: cgData.community_score,
      reddit_subscribers: cgData.reddit_subscribers,
      reddit_active_users_48h: cgData.reddit_active_users_48h,
      reddit_posts_48h: cgData.reddit_posts_48h,
      telegram_users: cgData.telegram_users,
      has_social_links: dex.hasLinks,
      social_link_count: dex.linkCount,
    },
    developer: {
      score: cgData.developer_score,
      github_stars: cgData.github_stars,
      github_forks: cgData.github_forks,
      commit_count_4_weeks: cgData.commit_count_4_weeks,
      pull_requests_merged: cgData.pull_requests_merged,
      contributors: cgData.contributors,
    },
    crowd: {
      votes_up_pct: cgData.sentiment_votes_up_pct,
      votes_down_pct: cgData.sentiment_votes_down_pct,
      public_interest_score: cgData.public_interest_score,
    },
    market_context: {
      fear_greed_value: fg.value,
      fear_greed_label: fg.label,
    },
    red_flags: redFlags,
    positive_signals: positiveSignals,
    verdict,
  };
}

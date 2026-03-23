import axios from 'axios';
import { ACPX_API } from '../config/api-endpoints.js';
import { cache } from './cache.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('agent-quality');
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Interfaces ──────────────────────────────────────────────────────

export interface AgentProfile {
  acpId: number;
  name: string;
  walletAddress: string;
  successRate: number;
  successfulJobCount: number;
  totalJobCount: number;
  failedJobCount: number;
  revenue: number;
  uniqueBuyerCount: number;
  rating: number;
  category: string;
  role: string;
  isOnline: boolean;
  lastActiveAt: string;
  offerings: AgentOffering[];
}

export interface AgentOffering {
  name: string;
  description: string;
  price: number;
  priceType: string;
  slaMinutes: number;
}

export interface AgentComparison {
  name: string;
  acpId: number;
  successRate: number;
  price: number;
  jobCount: number;
  revenue: number;
  uniqueBuyers: number;
  isOnline: boolean;
  offeringName: string;
  // Enriched signals
  trustScore: number;
  buyerConcentration: number;
  costPerSuccess: number;
  confidenceScore: number;
  compositeScore: number;
}

// ─── Signal 1: Gaming Detection / Trust Score ────────────────────────

/**
 * Compute a trust score (0-100) based on signals that detect gaming:
 * - Revenue per buyer (too low = mutual_boost_micro gaming)
 * - Jobs per buyer (too high from too few = self-dealing)
 * - Success rate anomalies (100% on meaningful volume = suspicious)
 */
function computeTrustScore(
  successRate: number,
  totalJobs: number,
  revenue: number,
  uniqueBuyers: number,
): number {
  let score = 100;

  // Revenue per buyer — <$0.05 avg per buyer is suspicious (micro boost gaming)
  if (uniqueBuyers > 0) {
    const revenuePerBuyer = revenue / uniqueBuyers;
    if (revenuePerBuyer < 0.05 && totalJobs > 100) {
      score -= 40; // heavy penalty: looks like $0.01 mutual boost
    } else if (revenuePerBuyer < 0.50 && totalJobs > 500) {
      score -= 20; // moderate penalty
    }
  }

  // Jobs per unique buyer — >500 jobs per buyer = likely self-dealing
  if (uniqueBuyers > 0 && totalJobs > 100) {
    const jobsPerBuyer = totalJobs / uniqueBuyers;
    if (jobsPerBuyer > 500) {
      score -= 25;
    } else if (jobsPerBuyer > 100) {
      score -= 10;
    }
  }

  // Perfect 100% success rate on high volume = suspicious
  if (successRate >= 100 && totalJobs > 1000) {
    score -= 10;
  }

  // No buyers at all but has jobs = definitely gaming
  if (uniqueBuyers === 0 && totalJobs > 10) {
    score -= 50;
  }

  // Bonus for diverse buyer base
  if (uniqueBuyers > 100 && revenue > 1000) {
    score += 5;
  }

  return Math.max(0, Math.min(100, score));
}

// ─── Signal 2: Buyer Concentration Risk ──────────────────────────────

/**
 * Measure buyer concentration (0-1 scale).
 * 0 = perfectly distributed, 1 = all jobs from single buyer.
 * Uses jobs/buyer ratio as proxy (we don't have per-buyer breakdowns).
 */
function computeBuyerConcentration(totalJobs: number, uniqueBuyers: number): number {
  if (totalJobs <= 0 || uniqueBuyers <= 0) return 1;
  if (uniqueBuyers === 1) return 1;

  // Perfect distribution = 1 job per buyer. Higher ratio = more concentrated.
  const jobsPerBuyer = totalJobs / uniqueBuyers;

  // Normalize: 1 job/buyer = 0 concentration, 100+ = high concentration
  const concentration = Math.min(1, Math.log10(jobsPerBuyer) / 2);
  return round(Math.max(0, concentration));
}

// ─── Signal 3: Smart Money Signal ────────────────────────────────────

// Top buyer agents by volume — these are the "smart money"
const SMART_MONEY_AGENTS = new Set([
  'Butler', 'Axelrod', 'Nox', 'Otto AI', 'Seeker', 'Remi',
]);

/**
 * Fetch recent job log entries to see which providers smart money routes to.
 * Returns a map of providerId -> smart money job count.
 */
async function fetchSmartMoneyRouting(): Promise<Map<number, number>> {
  const cacheKey = 'smart-money-routing';
  const cached = cache.get<Map<number, number>>(cacheKey);
  if (cached) return cached;

  const routing = new Map<number, number>();

  // Sample multiple pages of recent job log
  for (let page = 1; page <= 10; page++) {
    try {
      const resp = await axios.get(`${ACPX_API.baseUrl}/agdp/job-log`, {
        params: {
          'pagination[pageSize]': 100,
          'pagination[page]': page,
          'sort': 'id:desc',
        },
        timeout: 15000,
      });

      const jobs = resp.data?.data ?? [];
      if (jobs.length === 0) break;

      for (const job of jobs) {
        const clientName = job.clientName ?? '';
        const providerId = job.providerId;
        if (providerId && SMART_MONEY_AGENTS.has(clientName)) {
          routing.set(providerId, (routing.get(providerId) ?? 0) + 1);
        }
      }

      await delay(200);
    } catch {
      break;
    }
  }

  cache.set(cacheKey, routing, 30 * 60 * 1000); // 30 min cache
  return routing;
}

// ─── Signal 4: Value Score (Cost per Successful Job) ─────────────────

/**
 * Calculate effective cost per successful job.
 * If an agent charges $1 but fails 50% of the time, your real cost is $2 per success.
 */
function computeCostPerSuccess(price: number, successRate: number): number {
  if (successRate <= 0) return Infinity;
  if (price <= 0) return 0;
  return round(price / (successRate / 100));
}

// ─── Signal 5: Confidence Score ──────────────────────────────────────

/**
 * How much should you trust this agent's success rate?
 * Based on job volume: more jobs = higher confidence.
 * Uses log scale: ~10K jobs = full confidence.
 */
function computeConfidence(totalJobs: number): number {
  if (totalJobs <= 0) return 0;
  return round(Math.min(1, Math.log10(totalJobs) / 4) * 100);
}

// ─── Composite Score ─────────────────────────────────────────────────

/**
 * Single composite score (0-100) combining all signals.
 * Weights:
 *   - Success rate: 35% (core reliability)
 *   - Trust score: 25% (gaming detection)
 *   - Confidence: 20% (track record depth)
 *   - Buyer diversity: 10% (1 - concentration)
 *   - Value: 10% (cost efficiency)
 */
function computeCompositeScore(
  successRate: number,
  trustScore: number,
  confidence: number,
  buyerConcentration: number,
  costPerSuccess: number,
  price: number,
): number {
  const srScore = Math.min(successRate, 100);
  const diversityScore = (1 - buyerConcentration) * 100;

  // Value score: invert cost-per-success, normalize to 0-100
  // Free agents get 100. $10+ per success gets ~0.
  let valueScore = 100;
  if (costPerSuccess > 0) {
    valueScore = Math.max(0, 100 - costPerSuccess * 10);
  }

  const composite =
    srScore * 0.35 +
    trustScore * 0.25 +
    confidence * 0.20 +
    diversityScore * 0.10 +
    valueScore * 0.10;

  return round(Math.min(100, Math.max(0, composite)));
}

// ─── Core Functions ──────────────────────────────────────────────────

export async function fetchAgentProfile(acpId: number): Promise<AgentProfile | null> {
  const cacheKey = `profile:${acpId}`;
  const cached = cache.get<AgentProfile>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${ACPX_API.baseUrl}/agents/${acpId}/details`;
    const resp = await axios.get(url, { timeout: 10000 });
    const d = resp.data?.data;
    if (!d) return null;

    const m = d.metrics ?? {};
    const successRate = Math.min(m.successRate ?? d.successRate ?? 0, 100);
    const successfulJobs = m.successfulJobCount ?? d.successfulJobCount ?? 0;
    const totalJobs = successRate > 0
      ? Math.round(successfulJobs / (successRate / 100))
      : successfulJobs;
    const failedJobs = Math.max(0, totalJobs - successfulJobs);

    const profile: AgentProfile = {
      acpId: d.id,
      name: d.name ?? '',
      walletAddress: d.walletAddress ?? '',
      successRate,
      successfulJobCount: successfulJobs,
      totalJobCount: totalJobs,
      failedJobCount: failedJobs,
      revenue: m.revenue ?? d.revenue ?? 0,
      uniqueBuyerCount: m.uniqueBuyerCount ?? d.uniqueBuyerCount ?? 0,
      rating: m.rating ?? d.rating ?? 0,
      category: d.category ?? '',
      role: d.role ?? '',
      isOnline: m.isOnline ?? false,
      lastActiveAt: m.lastActiveAt ?? d.lastActiveAt ?? '',
      offerings: (d.jobs ?? []).map((j: Record<string, unknown>) => ({
        name: (j.name as string) ?? '',
        description: (j.description as string) ?? '',
        price: (j.price as number) ?? (j.priceV2 as Record<string, unknown>)?.value ?? 0,
        priceType: (j.priceV2 as Record<string, unknown>)?.type as string ?? 'fixed',
        slaMinutes: (j.slaMinutes as number) ?? 0,
      })),
    };

    cache.set(cacheKey, profile, 10 * 60 * 1000);
    return profile;
  } catch (e) {
    log.error(`Failed to fetch profile for agent ${acpId}`, e);
    return null;
  }
}

export async function resolveAgent(query: string): Promise<AgentProfile | null> {
  const normalized = query.replace(/^\$/, '').trim().toLowerCase();

  const asNum = parseInt(normalized, 10);
  if (!isNaN(asNum) && asNum > 0) {
    return fetchAgentProfile(asNum);
  }

  try {
    const resp = await axios.get(`${ACPX_API.baseUrl}/agents`, {
      params: {
        'filters[name][$containsi]': normalized,
        'pagination[pageSize]': 5,
        'pagination[page]': 1,
      },
      timeout: 10000,
    });

    const results = resp.data?.data ?? [];
    if (results.length === 0) return null;

    const exact = results.find((r: Record<string, unknown>) =>
      (r.name as string)?.toLowerCase() === normalized,
    );
    const match = exact ?? results[0];
    return fetchAgentProfile(match.id as number);
  } catch (e) {
    log.error(`Failed to search for agent "${query}"`, e);
    return null;
  }
}

export async function findCompetingAgents(
  taskDescription: string,
  limit: number = 10,
): Promise<AgentComparison[]> {
  const cacheKey = `find:${taskDescription.toLowerCase().substring(0, 50)}`;
  const cached = cache.get<AgentComparison[]>(cacheKey);
  if (cached) return cached;

  const keywords = extractKeywords(taskDescription);
  const smartMoney = await fetchSmartMoneyRouting();
  const allAgents: AgentComparison[] = [];
  let page = 1;

  while (allAgents.length < 200 && page <= 5) {
    try {
      const resp = await axios.get(`${ACPX_API.baseUrl}/agents`, {
        params: {
          'filters[$and][0][$or][0][hasGraduated]': true,
          'filters[$and][0][$or][1][tag]': 'OPENCLAW',
          'filters[$and][1][$or][0][role]': 'provider',
          'filters[$and][1][$or][1][role]': 'hybrid',
          'pagination[pageSize]': 100,
          'pagination[page]': page,
          'sort': 'successfulJobCount:desc',
        },
        timeout: 15000,
      });

      const data = resp.data?.data ?? [];
      if (data.length === 0) break;

      for (const agent of data) {
        const jobs = agent.jobs ?? [];
        const sr = Math.min(agent.successRate ?? agent.metrics?.successRate ?? 0, 100);
        const successful = agent.successfulJobCount ?? agent.metrics?.successfulJobCount ?? 0;
        const total = sr > 0 ? Math.round(successful / (sr / 100)) : successful;
        const revenue = agent.revenue ?? agent.metrics?.revenue ?? 0;
        const buyers = agent.uniqueBuyerCount ?? agent.metrics?.uniqueBuyerCount ?? 0;

        for (const job of jobs) {
          const jobName = (job.name ?? '').toLowerCase();
          const jobDesc = (job.description ?? '').toLowerCase();

          const matchScore = keywords.reduce((score: number, kw: string) => {
            if (jobName.includes(kw)) return score + 3;
            if (jobDesc.includes(kw)) return score + 1;
            return score;
          }, 0);

          if (matchScore > 0) {
            const price = Math.min(job.price ?? job.priceV2?.value ?? 0, 100);
            const trust = computeTrustScore(sr, total, revenue, buyers);
            const concentration = computeBuyerConcentration(total, buyers);
            const cps = computeCostPerSuccess(price, sr);
            const confidence = computeConfidence(total);

            allAgents.push({
              name: agent.name,
              acpId: agent.id,
              successRate: sr,
              price,
              jobCount: successful,
              revenue,
              uniqueBuyers: buyers,
              isOnline: agent.metrics?.isOnline ?? false,
              offeringName: job.name,
              trustScore: trust,
              buyerConcentration: concentration,
              costPerSuccess: cps,
              confidenceScore: confidence,
              compositeScore: computeCompositeScore(sr, trust, confidence, concentration, cps, price),
            });
          }
        }
      }

      page++;
      await delay(200);
    } catch {
      break;
    }
  }

  // Deduplicate by agent (keep highest composite score per agent)
  const byAgent = new Map<number, AgentComparison>();
  for (const a of allAgents) {
    const existing = byAgent.get(a.acpId);
    if (!existing || a.compositeScore > existing.compositeScore) {
      byAgent.set(a.acpId, a);
    }
  }

  // Boost composite score for smart money favorites
  for (const [id, agent] of byAgent) {
    const smCount = smartMoney.get(id) ?? 0;
    if (smCount > 0) {
      // Up to +10 bonus for heavy smart money routing
      const bonus = Math.min(10, smCount * 2);
      agent.compositeScore = round(Math.min(100, agent.compositeScore + bonus));
    }
  }

  // Sort by composite score (incorporates all 5 signals)
  const sorted = [...byAgent.values()]
    .filter((a) => a.jobCount >= 10)
    .sort((a, b) => b.compositeScore - a.compositeScore)
    .slice(0, limit);

  cache.set(cacheKey, sorted, 15 * 60 * 1000);
  return sorted;
}

// ─── Formatting ──────────────────────────────────────────────────────

export async function formatCheckAgent(profile: AgentProfile): Promise<Record<string, unknown>> {
  const failRate = profile.totalJobCount > 0
    ? ((profile.totalJobCount - profile.successfulJobCount) / profile.totalJobCount * 100)
    : 0;

  let reliabilityTier: string;
  if (profile.successRate >= 95) reliabilityTier = 'excellent';
  else if (profile.successRate >= 85) reliabilityTier = 'good';
  else if (profile.successRate >= 70) reliabilityTier = 'fair';
  else if (profile.successRate >= 50) reliabilityTier = 'poor';
  else reliabilityTier = 'unreliable';

  const trustScore = computeTrustScore(
    profile.successRate, profile.totalJobCount, profile.revenue, profile.uniqueBuyerCount,
  );
  const buyerConcentration = computeBuyerConcentration(profile.totalJobCount, profile.uniqueBuyerCount);
  const confidence = computeConfidence(profile.totalJobCount);

  // Compute avg cost per success across all offerings
  const avgPrice = profile.offerings.length > 0
    ? profile.offerings.reduce((s, o) => s + o.price, 0) / profile.offerings.length
    : 0;
  const costPerSuccess = computeCostPerSuccess(avgPrice, profile.successRate);
  const compositeScore = computeCompositeScore(
    profile.successRate, trustScore, confidence, buyerConcentration, costPerSuccess, avgPrice,
  );

  // Smart money signal
  const smartMoney = await fetchSmartMoneyRouting();
  const smartMoneyJobs = smartMoney.get(profile.acpId) ?? 0;

  // Gaming flags
  const gamingFlags: string[] = [];
  if (profile.uniqueBuyerCount > 0 && profile.revenue / profile.uniqueBuyerCount < 0.05 && profile.totalJobCount > 100) {
    gamingFlags.push('micro_boost_pattern');
  }
  if (profile.uniqueBuyerCount > 0 && profile.totalJobCount / profile.uniqueBuyerCount > 500) {
    gamingFlags.push('self_dealing_risk');
  }
  if (profile.successRate >= 100 && profile.totalJobCount > 1000) {
    gamingFlags.push('perfect_rate_anomaly');
  }

  return {
    agent: profile.name,
    id: profile.acpId,
    is_online: profile.isOnline,
    composite_score: compositeScore,
    reliability: {
      success_rate: round(profile.successRate),
      tier: reliabilityTier,
      total_jobs: profile.totalJobCount,
      successful_jobs: profile.successfulJobCount,
      failed_jobs: profile.failedJobCount,
      fail_rate_pct: round(failRate),
    },
    trust: {
      trust_score: trustScore,
      gaming_flags: gamingFlags.length > 0 ? gamingFlags : 'none',
      buyer_concentration: buyerConcentration,
      buyer_concentration_label: buyerConcentration > 0.7 ? 'high_risk'
        : buyerConcentration > 0.4 ? 'moderate' : 'healthy',
      confidence_score: confidence,
      confidence_label: confidence >= 75 ? 'high' : confidence >= 40 ? 'moderate' : 'low',
    },
    value: {
      avg_price_usd: round(avgPrice),
      cost_per_successful_job: costPerSuccess === Infinity ? 'n/a' : costPerSuccess,
    },
    smart_money: {
      routed_by_top_buyers: smartMoneyJobs > 0,
      recent_smart_money_jobs: smartMoneyJobs,
      signal: smartMoneyJobs >= 10 ? 'strong' : smartMoneyJobs > 0 ? 'weak' : 'none',
    },
    usage: {
      total_revenue_usd: round(profile.revenue),
      unique_buyers: profile.uniqueBuyerCount,
      rating: profile.rating,
    },
    offerings: profile.offerings.map((o) => ({
      name: o.name,
      price_usd: o.price,
      cost_per_success: computeCostPerSuccess(o.price, profile.successRate),
      sla_minutes: o.slaMinutes,
      description: o.description.substring(0, 120),
    })),
    summary: generateCheckSummary(profile, reliabilityTier, trustScore, smartMoneyJobs, gamingFlags),
  };
}

export function formatFindAgent(
  task: string,
  results: AgentComparison[],
  allMatchCount?: number,
): Record<string, unknown> {
  return {
    query: task,
    results_count: results.length,
    total_matching_agents: allMatchCount ?? results.length,
    agents: results.map((a, i) => ({
      rank: i + 1,
      agent: a.name,
      id: a.acpId,
      composite_score: a.compositeScore,
      offering: a.offeringName,
      success_rate: round(a.successRate),
      price_usd: a.price,
      cost_per_success: a.costPerSuccess === Infinity ? 'n/a' : a.costPerSuccess,
      trust_score: a.trustScore,
      confidence: a.confidenceScore,
      buyer_concentration: a.buyerConcentration,
      total_jobs: a.jobCount,
      total_revenue_usd: round(a.revenue),
      unique_buyers: a.uniqueBuyers,
      is_online: a.isOnline,
    })),
    summary: results.length > 0
      ? `Found ${allMatchCount ?? results.length} agents for "${task}". ` +
        `Top pick: ${results[0].name} (score: ${results[0].compositeScore}/100, ` +
        `${round(results[0].successRate)}% success, ` +
        `$${results[0].price}/job, ` +
        `trust: ${results[0].trustScore}/100).`
      : `No agents found matching "${task}".`,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────

function extractKeywords(description: string): string[] {
  const stopWords = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'as', 'into', 'about', 'between',
    'through', 'after', 'before', 'above', 'below', 'and', 'or', 'but',
    'not', 'no', 'nor', 'so', 'yet', 'both', 'either', 'neither', 'each',
    'every', 'all', 'any', 'few', 'more', 'most', 'other', 'some', 'such',
    'than', 'too', 'very', 'just', 'that', 'this', 'these', 'those',
    'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she', 'it',
    'they', 'them', 'what', 'which', 'who', 'whom', 'whose', 'where',
    'when', 'how', 'why', 'best', 'good', 'find', 'get', 'want', 'need',
    'agent', 'agents', 'service', 'services', 'use', 'using',
  ]);

  return description
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w))
    .slice(0, 8);
}

function generateCheckSummary(
  profile: AgentProfile,
  tier: string,
  trustScore: number,
  smartMoneyJobs: number,
  gamingFlags: string[],
): string {
  const parts: string[] = [];

  switch (tier) {
    case 'excellent':
      parts.push(`${profile.name} is highly reliable with a ${round(profile.successRate)}% success rate.`);
      break;
    case 'good':
      parts.push(`${profile.name} has good reliability at ${round(profile.successRate)}% success rate.`);
      break;
    case 'fair':
      parts.push(`${profile.name} has a fair success rate of ${round(profile.successRate)}%. Consider alternatives for critical tasks.`);
      break;
    case 'poor':
      parts.push(`${profile.name} has a poor success rate of ${round(profile.successRate)}%. Roughly ${Math.round(100 - profile.successRate)}% of jobs fail.`);
      break;
    case 'unreliable':
      parts.push(`Warning: ${profile.name} has a ${round(profile.successRate)}% success rate. Most jobs fail. Look for alternatives.`);
      break;
  }

  if (profile.successfulJobCount > 10000) {
    parts.push(`Proven at scale with ${profile.successfulJobCount.toLocaleString()} completed jobs.`);
  } else if (profile.successfulJobCount > 1000) {
    parts.push(`Moderate track record with ${profile.successfulJobCount.toLocaleString()} completed jobs.`);
  } else if (profile.successfulJobCount > 100) {
    parts.push(`Limited track record: ${profile.successfulJobCount.toLocaleString()} completed jobs.`);
  } else {
    parts.push(`Very new agent with only ${profile.successfulJobCount} completed jobs.`);
  }

  if (profile.uniqueBuyerCount > 1000) {
    parts.push(`Broadly adopted with ${profile.uniqueBuyerCount.toLocaleString()} unique buyers.`);
  }

  if (trustScore < 50) {
    parts.push(`⚠️ Low trust score (${trustScore}/100) — potential metric gaming detected.`);
  }

  if (gamingFlags.length > 0) {
    parts.push(`Flagged: ${gamingFlags.join(', ')}.`);
  }

  if (smartMoneyJobs >= 10) {
    parts.push(`Trusted by top buyer agents (${smartMoneyJobs} recent jobs from smart money).`);
  }

  if (!profile.isOnline) {
    parts.push('Currently offline.');
  }

  return parts.join(' ');
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

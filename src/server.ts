/**
 * AgentCheck — ACP Job Listener Server
 *
 * Listens for incoming ACP jobs (check_agent, find_agent) and responds
 * with quality intelligence data.
 */
import 'dotenv/config';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const AcpModule = require('@virtuals-protocol/acp-node');
const AcpClient = AcpModule.default ?? AcpModule.AcpClient ?? AcpModule;
const { AcpContractClientV2, baseAcpConfigV2, AcpJobPhases } = AcpModule;
type AcpJob = any;
type AcpMemo = any;
import { resolveAgent, findCompetingAgents, formatCheckAgent, formatFindAgent } from './data/agent-quality.js';
import { createLogger } from './utils/logger.js';

const log = createLogger('server');

// ─── Job Queue (concurrent request handling) ─────────────────────────

class JobQueue {
  private queue: Array<{ job: AcpJob; memo?: AcpMemo }> = [];
  private processing = 0;
  private readonly maxConcurrent: number;

  constructor(maxConcurrent = 5) {
    this.maxConcurrent = maxConcurrent;
  }

  enqueue(job: AcpJob, memo?: AcpMemo): void {
    this.queue.push({ job, memo });
    log.info(`Job #${job.id} queued (queue: ${this.queue.length}, active: ${this.processing})`);
    this.processNext();
  }

  private async processNext(): Promise<void> {
    if (this.processing >= this.maxConcurrent || this.queue.length === 0) return;

    const item = this.queue.shift();
    if (!item) return;

    this.processing++;
    try {
      await handleJob(item.job, item.memo);
    } catch (e) {
      log.error(`Queue error on job #${item.job.id}:`, e);
    } finally {
      this.processing--;
      this.processNext();
    }
  }

  get stats() {
    return { queued: this.queue.length, active: this.processing };
  }
}

const jobQueue = new JobQueue(5);

// ─── Config (from environment) ───────────────────────────────────────

const PRIVATE_KEY = process.env.ACP_PRIVATE_KEY;
const SESSION_KEY_ID = parseInt(process.env.ACP_SESSION_KEY_ID ?? '0', 10);
const AGENT_WALLET = process.env.ACP_AGENT_WALLET;
const CUSTOM_RPC = process.env.ACP_RPC_URL;

if (!PRIVATE_KEY || !AGENT_WALLET) {
  console.error('Missing required environment variables:');
  console.error('  ACP_PRIVATE_KEY    - Your agent wallet private key');
  console.error('  ACP_AGENT_WALLET   - Your agent wallet address');
  console.error('  ACP_SESSION_KEY_ID - Session entity key ID (default: 0)');
  console.error('  ACP_RPC_URL        - (optional) Custom Base RPC URL');
  process.exit(1);
}

// ─── Job Handler ─────────────────────────────────────────────────────

async function handleJob(job: AcpJob, memoToSign?: AcpMemo): Promise<void> {
  const jobId = job.id;

  try {
    // ── Phase 1: REQUEST → Accept/reject the incoming job ──
    if (
      job.phase === AcpJobPhases.REQUEST &&
      memoToSign?.nextPhase === AcpJobPhases.NEGOTIATION
    ) {
      log.info(`New job request #${jobId} "${job.name}" from ${job.clientAddress}`);

      // Validate the request — reject incomplete or inappropriate jobs
      const reqJobName = job.name ?? '';
      const validJobNames = ['check_agent', 'find_agent'];
      const reqBody = typeof job.requirement === 'string'
        ? (() => { try { return JSON.parse(job.requirement as string); } catch { return { text: job.requirement }; } })()
        : job.requirement ?? {};

      if (!validJobNames.includes(reqJobName) && !reqBody.agent && !reqBody.task && !reqBody.text) {
        log.info(`Rejecting job #${jobId}: unrecognized job "${reqJobName}" with no valid parameters`);
        await job.reject(
          'AgentCheck only supports "check_agent" and "find_agent" jobs. ' +
          'For check_agent, provide {"agent": "<name or id>"}. ' +
          'For find_agent, provide {"task": "<description>"}.',
        );
        return;
      }

      // For check_agent: require an agent name or ID
      if (reqJobName === 'check_agent' && !reqBody.agent && !reqBody.text) {
        log.info(`Rejecting job #${jobId}: check_agent missing "agent" parameter`);
        await job.reject(
          'Missing required parameter "agent". Provide the agent name or ID to check, e.g. {"agent": "Luna"}.',
        );
        return;
      }

      // For find_agent: require a task description
      if (reqJobName === 'find_agent' && !reqBody.task && !reqBody.text) {
        log.info(`Rejecting job #${jobId}: find_agent missing "task" parameter`);
        await job.reject(
          'Missing required parameter "task". Describe what you need, e.g. {"task": "swap tokens"}.',
        );
        return;
      }

      await job.accept('AgentCheck will process your request.');
      await job.createRequirement(`Job #${jobId} accepted. Please confirm payment to proceed.`);
      log.info(`Job #${jobId} accepted`);
      return;
    }

    // ── Phase 2: TRANSACTION → Process and deliver result ──
    if (
      job.phase === AcpJobPhases.TRANSACTION &&
      memoToSign?.nextPhase === AcpJobPhases.EVALUATION
    ) {
      log.info(`Processing job #${jobId} "${job.name}"`);

      // Parse the requirement
      const requirement = typeof job.requirement === 'string'
        ? (() => { try { return JSON.parse(job.requirement as string); } catch { return { text: job.requirement }; } })()
        : job.requirement ?? {};

      let result: Record<string, unknown>;

      // Route based on job name or requirement content
      const jobName = job.name ?? '';

      if (jobName === 'check_agent' || requirement.agent) {
        const agentQuery = requirement.agent ?? requirement.text ?? '';
        log.info(`check_agent: "${agentQuery}"`);
        const profile = await resolveAgent(agentQuery);

        if (!profile) {
          result = { error: 'agent_not_found', query: agentQuery,
            message: `Could not find agent "${agentQuery}". Try the exact name or ID number.` };
        } else {
          result = await formatCheckAgent(profile);
        }
      } else if (jobName === 'find_agent' || requirement.task) {
        const taskQuery = requirement.task ?? requirement.text ?? '';
        const maxResults = requirement.max_results ?? 5;
        log.info(`find_agent: "${taskQuery}" (max: ${maxResults})`);
        const results = await findCompetingAgents(taskQuery, maxResults);
        result = formatFindAgent(taskQuery, results);
      } else {
        // Infer intent from freeform text
        const text = requirement.text ?? JSON.stringify(requirement);
        const checkPattern = /^(check|is|should i use|how is|review|rate|reliable|report on)\s+/i;
        const match = text.match(checkPattern);

        if (match) {
          const agentName = text.replace(checkPattern, '').trim();
          log.info(`Inferred check_agent: "${agentName}"`);
          const profile = await resolveAgent(agentName);
          result = profile
            ? await formatCheckAgent(profile)
            : { error: 'agent_not_found', query: agentName };
        } else {
          log.info(`Inferred find_agent: "${text}"`);
          const results = await findCompetingAgents(text);
          result = formatFindAgent(text, results);
        }
      }

      await job.deliver(result);
      log.info(`Job #${jobId} delivered`);
    }
  } catch (error) {
    log.error(`Error on job #${jobId}:`, error);
    try {
      await job.reject(`Error: ${(error as Error).message}`);
    } catch {
      log.error(`Failed to reject job #${jobId} after error`);
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  log.info('Starting AgentCheck...');

  // Build the contract client
  log.info('Building ACP contract client...');
  const contractClient = await AcpContractClientV2.build(
    PRIVATE_KEY as `0x${string}`,
    SESSION_KEY_ID,
    AGENT_WALLET as `0x${string}`,
    baseAcpConfigV2,
  );

  // Create ACP client with job listener
  log.info('Initializing ACP client...');
  const acpClient = new AcpClient({
    acpContractClient: contractClient,
    onNewTask: (job: AcpJob, memo?: AcpMemo) => jobQueue.enqueue(job, memo),
    ...(CUSTOM_RPC ? { customRpcUrl: CUSTOM_RPC } : {}),
  });

  await acpClient.init();

  log.info('AgentCheck is live and listening for jobs!');
  log.info(`Wallet: ${AGENT_WALLET}`);
  log.info('Offerings: check_agent ($0.01), find_agent ($0.02)');

  // Also poll for any pending jobs we might have missed
  const pollInterval = 30_000; // 30 seconds
  setInterval(async () => {
    try {
      const pendingJobs = await acpClient.getPendingMemoJobs(1, 10);
      const activeJobs = await acpClient.getActiveJobs(1, 10);

      const jobsToProcess = [...pendingJobs, ...activeJobs].filter(
        (j) => j.phase === AcpJobPhases.REQUEST || j.phase === AcpJobPhases.TRANSACTION,
      );

      if (jobsToProcess.length > 0) {
        log.info(`Found ${jobsToProcess.length} pending jobs via polling`);
        for (const job of jobsToProcess) {
          jobQueue.enqueue(job);
        }
      }
    } catch (e) {
      log.error('Polling error', e);
    }
  }, pollInterval);

  // Keep process alive
  process.on('SIGINT', () => {
    log.info('Shutting down...');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    log.info('Shutting down...');
    process.exit(0);
  });
}

main().catch((e) => {
  log.error('Fatal error', e?.message ?? e);
  if (e?.stack) log.error('Stack:', e.stack);
  if (e?.cause) log.error('Cause:', e.cause);
  console.error('Full error:', JSON.stringify(e, Object.getOwnPropertyNames(e), 2));
  process.exit(1);
});

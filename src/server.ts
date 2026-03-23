/**
 * AgentOptimizer — ACP Job Listener Server
 *
 * Listens for incoming ACP jobs (check_agent, find_agent) and responds
 * with quality intelligence data.
 */
import AcpClient, {
  AcpContractClientV2,
  baseAcpConfigV2,
  AcpJob,
  AcpMemo,
  AcpJobPhases,
} from '@virtuals-protocol/acp-node';
import { resolveAgent, findCompetingAgents, formatCheckAgent, formatFindAgent } from './data/agent-quality.js';
import { createLogger } from './utils/logger.js';

const log = createLogger('server');

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
    onNewTask: handleJob,
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
          await handleJob(job);
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
  log.error('Fatal error', e);
  process.exit(1);
});

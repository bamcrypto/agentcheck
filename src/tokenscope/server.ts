import 'dotenv/config';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const AcpModule = require('@virtuals-protocol/acp-node');
const AcpClient = AcpModule.default ?? AcpModule.AcpClient;
const { AcpContractClientV2, baseAcpConfigV2, AcpJobPhases } = AcpModule;

import { scanToken, type ScanDepth } from './scanner.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('tokenscope-server');

// ─── Config ─────────────────────────────────────────────────────────

const PRIVATE_KEY = process.env.TOKENSCOPE_PRIVATE_KEY ?? process.env.ACP_PRIVATE_KEY;
const SESSION_KEY_ID = parseInt(process.env.TOKENSCOPE_SESSION_KEY_ID ?? process.env.ACP_SESSION_KEY_ID ?? '0', 10);
const AGENT_WALLET = process.env.TOKENSCOPE_AGENT_WALLET ?? process.env.ACP_AGENT_WALLET;

if (!PRIVATE_KEY || !AGENT_WALLET) {
  console.error('Missing required environment variables:');
  console.error('  TOKENSCOPE_PRIVATE_KEY    (or ACP_PRIVATE_KEY)');
  console.error('  TOKENSCOPE_AGENT_WALLET   (or ACP_AGENT_WALLET)');
  console.error('  TOKENSCOPE_SESSION_KEY_ID (or ACP_SESSION_KEY_ID, default: 0)');
  process.exit(1);
}

// ─── Job name → scan depth mapping ──────────────────────────────────

const JOB_DEPTH_MAP: Record<string, ScanDepth> = {
  quick_scan: 'quick',
  token_analysis: 'standard',
  technical_analysis: 'technical',
  full_report: 'full',
};

// ─── Job Handler ────────────────────────────────────────────────────

async function handleJob(job: any, memoToSign?: any): Promise<void> {
  const jobId = job.id;
  try {
    // Phase 1: Accept the job request
    if (job.phase === AcpJobPhases.REQUEST && memoToSign?.nextPhase === AcpJobPhases.NEGOTIATION) {
      log.info(`New job #${jobId} "${job.name}" from ${job.clientAddress}`);

      // Validate job name
      const jobName = job.name ?? '';
      if (!JOB_DEPTH_MAP[jobName]) {
        log.info(`Rejecting job #${jobId}: unsupported offering "${jobName}"`);
        await job.reject(`TokenScope does not support "${jobName}". Available: quick_scan, token_analysis, technical_analysis, full_report.`);
        return;
      }

      await job.accept('TokenScope will analyze your token.');
      await job.createRequirement(`Job #${jobId} accepted. Please confirm payment to proceed.`);
      log.info(`Job #${jobId} accepted`);
      return;
    }

    // Phase 2: Process the job
    if (job.phase === AcpJobPhases.TRANSACTION && memoToSign?.nextPhase === AcpJobPhases.EVALUATION) {
      log.info(`Processing job #${jobId} "${job.name}"`);

      // Parse requirement
      const requirement = typeof job.requirement === 'string'
        ? (() => { try { return JSON.parse(job.requirement); } catch { return { text: job.requirement }; } })()
        : job.requirement ?? {};

      // Extract token address/symbol
      const tokenInput = requirement.token ?? requirement.address ?? requirement.text ?? '';
      const chain = requirement.chain ?? 'base';

      if (!tokenInput) {
        log.info(`Rejecting job #${jobId}: no token specified`);
        await job.reject('Missing required parameter "token". Provide a contract address (0x...) or token symbol.');
        return;
      }

      // Validate token input
      const isAddress = /^0x[a-fA-F0-9]{40}$/.test(tokenInput.trim());
      const isSymbol = /^[a-zA-Z0-9$]{1,20}$/.test(tokenInput.trim());
      if (!isAddress && !isSymbol) {
        log.info(`Rejecting job #${jobId}: invalid token input "${tokenInput}"`);
        await job.reject(`Invalid token: "${tokenInput}". Provide a valid contract address (0x...) or token symbol.`);
        return;
      }

      // Determine scan depth from job name
      const depth = JOB_DEPTH_MAP[job.name ?? ''] ?? 'standard';

      // Execute scan
      const result = await scanToken(tokenInput.trim(), chain, depth);

      // Deliver result
      await job.deliver(result);
      log.info(`Job #${jobId} delivered: ${result.risk.level} (${result.risk.overall}/100) in ${result.scan_time_ms}ms`);
    }
  } catch (error: any) {
    log.error(`Error on job #${jobId}:`, error?.message ?? error);
    try {
      await job.reject(`Error processing request: ${error?.message ?? 'unknown error'}. Please try again.`);
    } catch {}
  }
}

// ─── Main ───────────────────────────────────────────────────────────

async function main(): Promise<void> {
  log.info('Starting TokenScope...');

  log.info('Building ACP contract client...');
  const contractClient = await AcpContractClientV2.build(
    PRIVATE_KEY,
    SESSION_KEY_ID,
    AGENT_WALLET,
    baseAcpConfigV2,
  );

  log.info('Initializing ACP client...');
  const acpClient = new AcpClient({
    acpContractClient: contractClient,
    onNewTask: handleJob,
  });
  await acpClient.init();

  log.info('TokenScope is live and listening for jobs!');
  log.info(`Wallet: ${AGENT_WALLET}`);
  log.info('Offerings: quick_scan ($0.05), token_analysis ($0.15), technical_analysis ($0.50), full_report ($0.75)');

  // Polling fallback
  const pollInterval = 30000;
  setInterval(async () => {
    try {
      const pendingJobs = await acpClient.getPendingMemoJobs(1, 10);
      const activeJobs = await acpClient.getActiveJobs(1, 10);
      const jobsToProcess = [...pendingJobs, ...activeJobs].filter(
        (j: any) => j.phase === AcpJobPhases.REQUEST || j.phase === AcpJobPhases.TRANSACTION,
      );
      if (jobsToProcess.length > 0) {
        log.info(`Found ${jobsToProcess.length} pending jobs via polling`);
        for (const job of jobsToProcess) { await handleJob(job); }
      }
    } catch (e: any) { log.error('Polling error', e?.message); }
  }, pollInterval);

  process.on('SIGINT', () => { log.info('Shutting down...'); process.exit(0); });
  process.on('SIGTERM', () => { log.info('Shutting down...'); process.exit(0); });
}

main().catch((e: any) => {
  log.error('Fatal error', e?.message ?? e);
  console.error('Full error:', JSON.stringify(e, Object.getOwnPropertyNames(e ?? {}), 2));
  process.exit(1);
});

import initSqlJs from 'sql.js';
import type { Database as SqlJsDatabase } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../utils/logger.js';

const log = createLogger('database');

const DB_PATH = path.resolve('data', 'agents.db');

let db: SqlJsDatabase | null = null;

export async function getDb(): Promise<SqlJsDatabase> {
  if (db) return db;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
    log.info('Loaded existing database');
  } else {
    db = new SQL.Database();
    initSchema(db);
    log.info('Created new database');
  }

  return db;
}

export function saveDb(): void {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, buffer);
}

function initSchema(database: SqlJsDatabase): void {
  database.run(`
    CREATE TABLE IF NOT EXISTS agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_address TEXT UNIQUE NOT NULL,
      name TEXT,
      ticker TEXT,
      token_address TEXT,
      description TEXT,
      category TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS agent_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_address TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      total_jobs INTEGER DEFAULT 0,
      completed_jobs INTEGER DEFAULT 0,
      failed_jobs INTEGER DEFAULT 0,
      expired_jobs INTEGER DEFAULT 0,
      total_revenue_usd REAL DEFAULT 0,
      period_revenue_usd REAL DEFAULT 0,
      period_jobs INTEGER DEFAULT 0,
      unique_buyers INTEGER DEFAULT 0,
      top3_buyer_revenue_pct REAL DEFAULT 0,
      offerings_count INTEGER DEFAULT 0,
      FOREIGN KEY (agent_address) REFERENCES agents(agent_address)
    );

    CREATE TABLE IF NOT EXISTS token_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_address TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      price_usd REAL DEFAULT 0,
      market_cap REAL DEFAULT 0,
      holder_count INTEGER DEFAULT 0,
      volume_24h REAL DEFAULT 0,
      liquidity_usd REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS daily_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_address TEXT NOT NULL,
      date TEXT NOT NULL,
      thesis_score REAL,
      rating TEXT,
      revenue_to_mcap REAL,
      revenue_growth_30d REAL,
      job_velocity_trend REAL,
      success_rate REAL,
      buyer_concentration REAL,
      price_usd REAL,
      market_cap REAL,
      monthly_revenue REAL,
      UNIQUE(agent_address, date),
      FOREIGN KEY (agent_address) REFERENCES agents(agent_address)
    );

    CREATE TABLE IF NOT EXISTS job_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tx_hash TEXT UNIQUE NOT NULL,
      block_number INTEGER NOT NULL,
      timestamp TEXT NOT NULL,
      agent_address TEXT NOT NULL,
      buyer_address TEXT NOT NULL,
      job_id TEXT,
      event_type TEXT NOT NULL,
      amount_usd REAL DEFAULT 0,
      offering_id TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_agent_metrics_address ON agent_metrics(agent_address);
    CREATE INDEX IF NOT EXISTS idx_agent_metrics_timestamp ON agent_metrics(timestamp);
    CREATE INDEX IF NOT EXISTS idx_token_metrics_address ON token_metrics(token_address);
    CREATE INDEX IF NOT EXISTS idx_token_metrics_timestamp ON token_metrics(timestamp);
    CREATE INDEX IF NOT EXISTS idx_snapshots_address_date ON daily_snapshots(agent_address, date);
    CREATE INDEX IF NOT EXISTS idx_job_events_agent ON job_events(agent_address);
    CREATE INDEX IF NOT EXISTS idx_job_events_timestamp ON job_events(timestamp);
    CREATE INDEX IF NOT EXISTS idx_job_events_buyer ON job_events(buyer_address);
  `);

  saveDb();
  log.info('Database schema initialized');
}

// Helper query functions

export async function upsertAgent(agent: {
  agentAddress: string;
  name?: string;
  ticker?: string;
  tokenAddress?: string;
  description?: string;
  category?: string;
}): Promise<void> {
  const database = await getDb();
  database.run(
    `INSERT INTO agents (agent_address, name, ticker, token_address, description, category)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(agent_address) DO UPDATE SET
       name = COALESCE(excluded.name, agents.name),
       ticker = COALESCE(excluded.ticker, agents.ticker),
       token_address = COALESCE(excluded.token_address, agents.token_address),
       description = COALESCE(excluded.description, agents.description),
       category = COALESCE(excluded.category, agents.category),
       updated_at = datetime('now')`,
    [agent.agentAddress, agent.name ?? null, agent.ticker ?? null, agent.tokenAddress ?? null, agent.description ?? null, agent.category ?? null],
  );
}

export async function insertAgentMetrics(metrics: {
  agentAddress: string;
  timestamp: string;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  expiredJobs: number;
  totalRevenueUsd: number;
  periodRevenueUsd: number;
  periodJobs: number;
  uniqueBuyers: number;
  top3BuyerRevenuePct: number;
  offeringsCount: number;
}): Promise<void> {
  const database = await getDb();
  database.run(
    `INSERT INTO agent_metrics (agent_address, timestamp, total_jobs, completed_jobs, failed_jobs,
     expired_jobs, total_revenue_usd, period_revenue_usd, period_jobs, unique_buyers,
     top3_buyer_revenue_pct, offerings_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [metrics.agentAddress, metrics.timestamp, metrics.totalJobs, metrics.completedJobs,
     metrics.failedJobs, metrics.expiredJobs, metrics.totalRevenueUsd, metrics.periodRevenueUsd,
     metrics.periodJobs, metrics.uniqueBuyers, metrics.top3BuyerRevenuePct, metrics.offeringsCount],
  );
}

export async function insertTokenMetrics(metrics: {
  tokenAddress: string;
  timestamp: string;
  priceUsd: number;
  marketCap: number;
  holderCount: number;
  volume24h: number;
  liquidityUsd: number;
}): Promise<void> {
  const database = await getDb();
  database.run(
    `INSERT INTO token_metrics (token_address, timestamp, price_usd, market_cap, holder_count,
     volume_24h, liquidity_usd)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [metrics.tokenAddress, metrics.timestamp, metrics.priceUsd, metrics.marketCap,
     metrics.holderCount, metrics.volume24h, metrics.liquidityUsd],
  );
}

export async function insertDailySnapshot(snapshot: {
  agentAddress: string;
  date: string;
  thesisScore: number;
  rating: string;
  revenueToMcap: number;
  revenueGrowth30d: number;
  jobVelocityTrend: number;
  successRate: number;
  buyerConcentration: number;
  priceUsd: number;
  marketCap: number;
  monthlyRevenue: number;
}): Promise<void> {
  const database = await getDb();
  database.run(
    `INSERT OR REPLACE INTO daily_snapshots (agent_address, date, thesis_score, rating,
     revenue_to_mcap, revenue_growth_30d, job_velocity_trend, success_rate, buyer_concentration,
     price_usd, market_cap, monthly_revenue)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [snapshot.agentAddress, snapshot.date, snapshot.thesisScore, snapshot.rating,
     snapshot.revenueToMcap, snapshot.revenueGrowth30d, snapshot.jobVelocityTrend,
     snapshot.successRate, snapshot.buyerConcentration, snapshot.priceUsd, snapshot.marketCap,
     snapshot.monthlyRevenue],
  );
}

export async function insertJobEvent(event: {
  txHash: string;
  blockNumber: number;
  timestamp: string;
  agentAddress: string;
  buyerAddress: string;
  jobId?: string;
  eventType: string;
  amountUsd: number;
  offeringId?: string;
}): Promise<void> {
  const database = await getDb();
  database.run(
    `INSERT OR IGNORE INTO job_events (tx_hash, block_number, timestamp, agent_address,
     buyer_address, job_id, event_type, amount_usd, offering_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [event.txHash, event.blockNumber, event.timestamp, event.agentAddress,
     event.buyerAddress, event.jobId ?? null, event.eventType, event.amountUsd,
     event.offeringId ?? null],
  );
}

export async function getAgentList(): Promise<Array<{ agent_address: string; name: string; ticker: string; token_address: string }>> {
  const database = await getDb();
  const result = database.exec('SELECT agent_address, name, ticker, token_address FROM agents ORDER BY name');
  if (!result.length) return [];
  return result[0].values.map((row: unknown[]) => ({
    agent_address: row[0] as string,
    name: row[1] as string,
    ticker: row[2] as string,
    token_address: row[3] as string,
  }));
}

export async function getLatestAgentMetrics(agentAddress: string): Promise<Record<string, unknown> | null> {
  const database = await getDb();
  const result = database.exec(
    `SELECT * FROM agent_metrics WHERE agent_address = '${agentAddress}' ORDER BY timestamp DESC LIMIT 1`,
  );
  if (!result.length || !result[0].values.length) return null;
  const cols = result[0].columns;
  const row = result[0].values[0];
  const obj: Record<string, unknown> = {};
  cols.forEach((col: string, i: number) => { obj[col] = row[i]; });
  return obj;
}

export async function getLatestTokenMetrics(tokenAddress: string): Promise<Record<string, unknown> | null> {
  const database = await getDb();
  const result = database.exec(
    `SELECT * FROM token_metrics WHERE token_address = '${tokenAddress}' ORDER BY timestamp DESC LIMIT 1`,
  );
  if (!result.length || !result[0].values.length) return null;
  const cols = result[0].columns;
  const row = result[0].values[0];
  const obj: Record<string, unknown> = {};
  cols.forEach((col: string, i: number) => { obj[col] = row[i]; });
  return obj;
}

export async function getRecentSnapshots(agentAddress: string, days: number = 30): Promise<Array<Record<string, unknown>>> {
  const database = await getDb();
  const result = database.exec(
    `SELECT * FROM daily_snapshots WHERE agent_address = '${agentAddress}'
     ORDER BY date DESC LIMIT ${days}`,
  );
  if (!result.length) return [];
  const cols = result[0].columns;
  return result[0].values.map((row: unknown[]) => {
    const obj: Record<string, unknown> = {};
    cols.forEach((col: string, i: number) => { obj[col] = row[i]; });
    return obj;
  });
}

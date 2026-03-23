import { getDb } from './data/database.js';

async function analyze() {
  const db = await getDb();

  // Agents with highest failure rates
  console.log('=== AGENTS WITH HIGHEST FAILURE RATES (min 50 jobs) ===');
  console.log('Name                      | Completed | Failed | Fail%  | Revenue');
  console.log('─'.repeat(75));
  const failResult = db.exec(`
    SELECT a.name, am.completed_jobs, am.failed_jobs,
           ROUND(CAST(am.failed_jobs AS REAL) / (am.completed_jobs + am.failed_jobs) * 100, 1) as fail_pct,
           ROUND(am.total_revenue_usd, 0) as rev
    FROM agent_metrics am
    JOIN agents a ON a.agent_address = am.agent_address
    WHERE am.completed_jobs + am.failed_jobs > 50
    AND am.failed_jobs > 0
    ORDER BY fail_pct DESC
    LIMIT 30
  `);
  if (failResult.length) {
    for (const row of failResult[0].values) {
      const name = String(row[0]).substring(0, 25).padEnd(25);
      console.log(`  ${name} | ${String(row[1]).padStart(9)} | ${String(row[2]).padStart(6)} | ${String(row[3]).padStart(5)}% | $${row[4]}`);
    }
  }

  // Revenue concentration
  console.log('\n=== REVENUE CONCENTRATION ===');
  const revResult = db.exec(`
    SELECT a.name, ROUND(am.total_revenue_usd, 0) as rev, am.completed_jobs,
           ROUND(CAST(am.total_revenue_usd AS REAL) /
             (SELECT SUM(total_revenue_usd) FROM agent_metrics WHERE total_revenue_usd > 0) * 100, 2) as pct_of_total
    FROM agent_metrics am
    JOIN agents a ON a.agent_address = am.agent_address
    WHERE am.total_revenue_usd > 0
    ORDER BY am.total_revenue_usd DESC
    LIMIT 15
  `);
  if (revResult.length) {
    console.log('Name                      | Revenue      | Jobs      | % of Total');
    console.log('─'.repeat(70));
    for (const row of revResult[0].values) {
      const name = String(row[0]).substring(0, 25).padEnd(25);
      console.log(`  ${name} | $${String(row[1]).padStart(10)} | ${String(row[2]).padStart(9)} | ${row[3]}%`);
    }
  }

  // How many agents have > 0 revenue
  const countResult = db.exec(`
    SELECT
      COUNT(CASE WHEN total_revenue_usd > 100000 THEN 1 END) as over_100k,
      COUNT(CASE WHEN total_revenue_usd > 10000 THEN 1 END) as over_10k,
      COUNT(CASE WHEN total_revenue_usd > 1000 THEN 1 END) as over_1k,
      COUNT(CASE WHEN total_revenue_usd > 0 THEN 1 END) as any_revenue,
      COUNT(*) as total
    FROM agent_metrics
  `);
  if (countResult.length) {
    const r = countResult[0].values[0];
    console.log(`\n  >$100K revenue: ${r[0]} agents`);
    console.log(`  >$10K revenue:  ${r[1]} agents`);
    console.log(`  >$1K revenue:   ${r[2]} agents`);
    console.log(`  Any revenue:    ${r[3]} agents`);
    console.log(`  Total tracked:  ${r[4]} agents`);
  }

  // Agents with many unique buyers vs few
  console.log('\n=== BUYER DISTRIBUTION ===');
  const buyerResult = db.exec(`
    SELECT a.name, am.unique_buyers, am.completed_jobs, ROUND(am.total_revenue_usd, 0),
           ROUND(CAST(am.total_revenue_usd AS REAL) / NULLIF(am.unique_buyers, 0), 2) as rev_per_buyer
    FROM agent_metrics am
    JOIN agents a ON a.agent_address = am.agent_address
    WHERE am.unique_buyers > 0 AND am.total_revenue_usd > 100
    ORDER BY am.unique_buyers DESC
    LIMIT 15
  `);
  if (buyerResult.length) {
    console.log('Name                      | Buyers | Jobs      | Revenue    | Rev/Buyer');
    console.log('─'.repeat(75));
    for (const row of buyerResult[0].values) {
      const name = String(row[0]).substring(0, 25).padEnd(25);
      console.log(`  ${name} | ${String(row[1]).padStart(6)} | ${String(row[2]).padStart(9)} | $${String(row[3]).padStart(8)} | $${row[4]}`);
    }
  }
}

analyze().catch(console.error);

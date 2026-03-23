import { resolveAgent, findCompetingAgents, formatCheckAgent, formatFindAgent } from './data/agent-quality.js';
import { OFFERINGS } from './acp/offerings.js';
import { createLogger } from './utils/logger.js';

const log = createLogger('thesis');

async function main(): Promise<void> {
  const command = process.argv[2];

  switch (command) {
    case 'check': {
      // Check a specific agent's reliability
      const query = process.argv.slice(3).join(' ');
      if (!query) {
        console.error('Usage: check <agent_name_or_id>');
        console.error('Examples:');
        console.error('  check Ethy AI');
        console.error('  check Luna');
        console.error('  check 84');
        process.exit(1);
      }

      log.info(`Checking agent: "${query}"`);
      const profile = await resolveAgent(query);

      if (!profile) {
        console.log(JSON.stringify({ error: 'Agent not found', query }, null, 2));
        process.exit(1);
      }

      const result = await formatCheckAgent(profile);
      console.log(JSON.stringify(result, null, 2));
      break;
    }

    case 'find': {
      // Find best agents for a task
      const task = process.argv.slice(3).join(' ');
      if (!task) {
        console.error('Usage: find <task_description>');
        console.error('Examples:');
        console.error('  find swap tokens');
        console.error('  find token analysis');
        console.error('  find security audit');
        console.error('  find market intelligence');
        process.exit(1);
      }

      log.info(`Finding agents for: "${task}"`);
      const results = await findCompetingAgents(task);
      const formatted = formatFindAgent(task, results);
      console.log(JSON.stringify(formatted, null, 2));
      break;
    }

    case 'offerings': {
      // Show our ACP offering definitions
      console.log(JSON.stringify(OFFERINGS, null, 2));
      break;
    }

    default: {
      console.log('Thesis — Agent Quality Intelligence for ACP');
      console.log('');
      console.log('Commands:');
      console.log('  check <agent>   Check an agent\'s reliability stats');
      console.log('  find <task>     Find the best agent for a task');
      console.log('  offerings       Show ACP offering definitions');
      console.log('');
      console.log('Examples:');
      console.log('  npx tsx src/index.ts check Luna');
      console.log('  npx tsx src/index.ts find swap tokens');
      console.log('  npx tsx src/index.ts find "security audit"');
      break;
    }
  }
}

main().catch((e) => {
  log.error('Fatal error', e);
  process.exit(1);
});

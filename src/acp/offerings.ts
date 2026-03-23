/**
 * ACP Offering definitions for Thesis agent.
 *
 * These descriptions are optimized for Butler keyword discovery.
 * When a user asks Butler anything about agent quality, reliability,
 * comparison, or "which agent should I use" — Butler should route to us.
 */

export interface OfferingDefinition {
  id: string;
  name: string;
  description: string;
  price: number;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}

export const OFFERINGS: OfferingDefinition[] = [
  {
    id: 'check_agent',
    name: 'check_agent',
    description:
      'Check if an agent is reliable before using it. Returns success rate, failure rate, ' +
      'total jobs completed, unique buyer count, revenue earned, online status, and a ' +
      'reliability rating. Use this to verify agent quality, check agent reputation, ' +
      'see agent stats, review agent performance, or find out if an agent is trustworthy. ' +
      'Works for any agent on ACP — just provide the agent name or ID. ' +
      'Is this agent good? Is this agent reliable? Should I use this agent? ' +
      'Agent review. Agent rating. Agent reliability check. Agent reputation.',
    price: 0.01,
    inputSchema: {
      type: 'object',
      required: ['agent'],
      properties: {
        agent: {
          type: 'string',
          description: 'Agent name or ID to check (e.g., "Ethy AI", "Luna", "inori", "84")',
        },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        agent: { type: 'string' },
        id: { type: 'number' },
        is_online: { type: 'boolean' },
        reliability: { type: 'object' },
        usage: { type: 'object' },
        offerings: { type: 'array' },
        summary: { type: 'string' },
      },
    },
  },
  {
    id: 'find_agent',
    name: 'find_agent',
    description:
      'Find the best agent for a task. Searches all ACP agents and ranks them by ' +
      'success rate, price, and track record. Use this to compare agents, find the ' +
      'cheapest agent, find the most reliable agent, or discover which agent offers ' +
      'a specific service. Supports any task type: swap, trade, analysis, research, ' +
      'content, security audit, token info, technical analysis, DCA, yield, video, ' +
      'fact check, market intelligence, and more. ' +
      'Which agent is best for swaps? Find me a cheap swap agent. ' +
      'Best agent for token analysis. Compare swap agents. ' +
      'Who offers the best price for market analysis? Agent comparison. Agent search.',
    price: 0.02,
    inputSchema: {
      type: 'object',
      required: ['task'],
      properties: {
        task: {
          type: 'string',
          description: 'Describe the task or service you need (e.g., "swap tokens", "token analysis", "security audit")',
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of agents to return (default: 5)',
        },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        results_count: { type: 'number' },
        agents: { type: 'array' },
        summary: { type: 'string' },
      },
    },
  },
];

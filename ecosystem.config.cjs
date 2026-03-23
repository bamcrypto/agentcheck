// PM2 ecosystem config for AgentOptimizer
// Usage: pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'agent-optimizer',
      script: 'npx',
      args: 'tsx src/server.ts',
      cwd: '/home/user/agent-optimizer',
      env: {
        NODE_ENV: 'production',
        ACP_PRIVATE_KEY: '',       // Set via: pm2 set agent-optimizer:ACP_PRIVATE_KEY <key>
        ACP_AGENT_WALLET: '',      // Set via: pm2 set agent-optimizer:ACP_AGENT_WALLET <addr>
        ACP_SESSION_KEY_ID: '0',
        ACP_RPC_URL: '',           // Optional: custom Base RPC
      },
      // Restart on crash, max 10 restarts in 1 minute
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 5000,
      // Log config
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
  ],
};

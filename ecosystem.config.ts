// PM2 ecosystem config
export default {
  apps: [
    {
      name: 'idx-scraper',
      script: 'src/index.ts',
      interpreter: 'bun',
      cwd: '/root/.openclaw/workspace/idx-scraper',
      env: {
        PORT: 3100,
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: '500M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/root/.openclaw/workspace/idx-scraper/logs/error.log',
      out_file: '/root/.openclaw/workspace/idx-scraper/logs/out.log',
      merge_logs: true,
    },
  ],
};

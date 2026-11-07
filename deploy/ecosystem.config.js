/**
 * PM2 process config for the 0-Fake-Click Meta -> Telegram system.
 *
 * Usage:
 *   pm2 start deploy/ecosystem.config.js
 *   pm2 save
 *   pm2 startup
 */
module.exports = {
  apps: [
    {
      name: 'zero-fake-click',
      cwd: __dirname + '/..',
      script: 'server.js',

      // Single instance is REQUIRED: this app keeps state in memory
      // (SSE client set) and writes to a single data.json file.
      // Running in cluster mode would corrupt data.json.
      instances: 1,
      exec_mode: 'fork',

      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },

      // Auto-restart behaviour
      autorestart: true,
      max_restarts: 20,
      restart_delay: 3000,
      min_uptime: '10s',

      // Restart if the process balloons past 400 MB (leak guard)
      max_memory_restart: '400M',

      // Logs
      error_file: '/var/log/zero-fake-click/error.log',
      out_file: '/var/log/zero-fake-click/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      time: true
    }
  ]
};

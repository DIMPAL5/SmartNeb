module.exports = {
  apps: [
    {
      name: "smartneb-backend",
      script: "server.js",
      instances: "max",
      exec_mode: "cluster",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      restart_delay: 3000,
      max_restarts: 10,
      env: {
        NODE_ENV: "development",
        PORT: 5000,
      },
      env_staging: {
        NODE_ENV: "staging",
        PORT: 5000,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 5000,
      },
      kill_timeout: 6000,
      listen_timeout: 8000,
    },
  ],
};

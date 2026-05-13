/** Staging — osobny proces PM2 i port (np. 3001). Skopiuj .env → .env.staging i dostosuj DATABASE_URL / domeny. */
module.exports = {
  apps: [
    {
      name: "nieruchomosci-staging",
      cwd: "/home/rommar/estateos",
      script: "npm",
      args: "run start:prod",
      env_file: "/home/rommar/estateos/.env.staging",
      env: {
        NODE_ENV: "production",
        PORT: "3001",
      },
      env_staging: {
        NODE_ENV: "production",
        PORT: "3001",
      },
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      merge_logs: true,
      time: true,
    },
  ],
};

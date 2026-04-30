module.exports = {
  apps: [
    {
      name: "nieruchomosci",
      cwd: "/home/rommar/estateos",
      script: "npm",
      args: "run start:prod",
      env_file: "/home/rommar/estateos/.env",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: "3000",
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

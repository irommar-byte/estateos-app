module.exports = {
  apps: [
    {
      name: "lineage-movies-downloader",
      cwd: "/home/rommar/lineage-movies/video-downloader",
      script: "server.js",
      env: {
        PORT: "4321",
        NODE_ENV: "production",
        DOWNLOAD_DIR: "/home/rommar/lineage-movies/downloads/jobs",
        MUSIC_PLAYLIST_DOWNLOADS_DIR: "/home/rommar/lineage-movies/downloads",
        MOVIES_JWT_SECRET: "lineage-movies-jwt-prod-set-on-vps",
        LINEAGE_LOGIN_URL: "http://192.168.50.200/login.php",
      },
      max_memory_restart: "800M",
    },
    {
      name: "lineage-movies-proxy",
      cwd: "/home/rommar/lineage-movies",
      script: "auth-proxy.js",
      env: {
        MOVIES_AUTH_PROXY_PORT: "4322",
        MOVIES_DOWNLOADER_URL: "http://127.0.0.1:4321",
        LINEAGE_AUTH_CHECK_URL: "http://192.168.50.200/admin_pro/get_logs.php",
        LINEAGE_USER_PANEL_URL: "http://192.168.50.200/panel.php",
        LINEAGE_LOGIN_URL: "http://192.168.50.200/login.php",
        MOVIES_JWT_SECRET: "lineage-movies-jwt-prod-set-on-vps",
        NODE_ENV: "production",
      },
      max_memory_restart: "256M",
    },
  ],
};

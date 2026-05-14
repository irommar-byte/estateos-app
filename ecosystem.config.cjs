const path = require("path");
const root = __dirname;

/** Źródło env produkcyjnego: ten plik + `.env` w katalogu aplikacji (PM2 `env` + `env_file`). */
require("dotenv").config({ path: path.join(root, ".env") });

const pick = (key, fallback) => process.env[key] || fallback;

const normalizeOrigin = (value) => String(value || "").trim().replace(/\/$/, "");

const nextAuthOrigin = normalizeOrigin(process.env.NEXTAUTH_URL);
const passkeyOrigin =
  normalizeOrigin(process.env.PASSKEY_ORIGIN) || nextAuthOrigin || "https://estateos.pl";

const sharedEnv = {
  NODE_ENV: "production",
  PORT: pick("PORT", "3000"),
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  JWT_SECRET: process.env.JWT_SECRET,
  AUTH_SECRET: process.env.AUTH_SECRET,
  PASSKEY_RP_ID: pick("PASSKEY_RP_ID", "estateos.pl"),
  PASSKEY_ORIGIN: passkeyOrigin,
  APPLE_TEAM_ID: process.env.APPLE_TEAM_ID,
  IOS_BUNDLE_ID: process.env.IOS_BUNDLE_ID,
  ANDROID_PACKAGE_NAME: process.env.ANDROID_PACKAGE_NAME,
  ANDROID_SHA256_CERT_FINGERPRINT: process.env.ANDROID_SHA256_CERT_FINGERPRINT,
  ANDROID_SHA256_RELEASE_SIGNING_CERT: process.env.ANDROID_SHA256_RELEASE_SIGNING_CERT,
};

module.exports = {
  apps: [
    {
      name: "nieruchomosci",
      cwd: root,
      script: "npm",
      args: "run start:prod",
      env_file: path.join(root, ".env"),
      env: sharedEnv,
      env_production: sharedEnv,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",
      merge_logs: true,
      time: true,
    },
    {
      name: "reviews-finalization-fallback",
      cwd: root,
      script: "node",
      args: "scripts/reviews-finalization-fallback.cjs",
      env_file: path.join(root, ".env"),
      env: sharedEnv,
      env_production: sharedEnv,
      autorestart: false,
      cron_restart: "0 * * * *",
      time: true,
    },
  ],
};

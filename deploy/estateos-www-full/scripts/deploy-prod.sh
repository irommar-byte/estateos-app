#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/rommar/estateos"

cd "$APP_DIR"

echo "[1/4] Installing dependencies..."
npm ci

echo "[2/4] Syncing commit + atomic Next build..."
node scripts/sync-commit-sha.cjs
npm run build:atomic

echo "[3/4] Reloading PM2 process..."
npm run pm2:reload
node scripts/wait-web-ready.cjs

echo "[4/4] Saving PM2 process list..."
npm run pm2:save

echo "Done. Deployment completed (commit: $(git rev-parse --short HEAD))."

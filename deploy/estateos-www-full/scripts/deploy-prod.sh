#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/rommar/estateos"

cd "$APP_DIR"

echo "[1/4] Installing dependencies..."
npm ci

echo "[2/4] Building Next.js app..."
npm run build

echo "[3/4] Reloading PM2 process..."
npm run pm2:reload

echo "[4/4] Saving PM2 process list..."
npm run pm2:save

echo "Done. Deployment completed."

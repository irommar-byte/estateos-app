#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/rommar/estateos"

cd "$APP_DIR"

export COMMIT_SHA="${COMMIT_SHA:-$(git rev-parse --short HEAD 2>/dev/null || echo unknown)}"
echo "Building commit: $COMMIT_SHA"
if grep -q "^COMMIT_SHA=" .env 2>/dev/null; then
  sed -i "s/^COMMIT_SHA=.*/COMMIT_SHA=$COMMIT_SHA/" .env
else
  echo "COMMIT_SHA=$COMMIT_SHA" >> .env
fi

echo "[1/4] Installing dependencies..."
npm ci

echo "[2/4] Building Next.js app..."
COMMIT_SHA="$COMMIT_SHA" npm run build

echo "[3/4] Reloading PM2 process..."
COMMIT_SHA="$COMMIT_SHA" npm run pm2:reload

echo "[4/4] Saving PM2 process list..."
npm run pm2:save

echo "Done. Deployment completed (commit: $COMMIT_SHA)."

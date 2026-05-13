#!/usr/bin/env bash
# EstateOS™ — odtworzenie working tree z GitHub po awarii (fetch + reset).
# Wymaga jawnej zgody: RECOVER_CONFIRM=1
# Opcjonalnie: BACKUP_APP_DIR=1 — tar całego APP_ROOT (bez node_modules/.next) przed resetem.

set -euo pipefail

APP_ROOT="${APP_ROOT:-/home/rommar/estateos}"
BRANCH="${RECOVER_BRANCH:-}"

if [[ "${RECOVER_CONFIRM:-0}" != "1" ]]; then
  echo "Odmowa: ustaw RECOVER_CONFIRM=1 aby wykonać recovery (destructive: git reset --hard)." >&2
  exit 1
fi

cd "$APP_ROOT"

STAMP="$(date +%Y%m%d_%H%M%S)"
REC_DIR="$APP_ROOT/.deploy/recovery"
mkdir -p "$REC_DIR"

if [[ "${BACKUP_APP_DIR:-0}" == "1" ]]; then
  echo "==> backup tar katalogu aplikacji (bez node_modules/.next) -> ${REC_DIR}/app_tree_${STAMP}.tgz"
  tar --exclude='node_modules' --exclude='.next' -czf "$REC_DIR/app_tree_${STAMP}.tgz" \
    -C "$(dirname "$APP_ROOT")" "$(basename "$APP_ROOT")" || {
    echo "ERROR: backup tar nieudany" >&2
    exit 1
  }
fi

echo "==> git fetch --all --prune"
git fetch --all --prune

if [[ -z "$BRANCH" ]]; then
  BRANCH="$(git branch --show-current)"
fi

echo "==> reset --hard origin/${BRANCH}"
git reset --hard "origin/${BRANCH}"

echo "Recovery OK. HEAD=$(git rev-parse HEAD) branch=${BRANCH}"
echo "Następnie: npm ci && npx prisma generate && npm run build && pm2 reload ecosystem.config.cjs --env production --update-env"

#!/usr/bin/env bash
# Przywraca .next (i opcjonalnie node_modules/.prisma) z katalogu releases/<id>, potem pm2 reload.
# Wymaga wcześniejszego deployu z RELEASE_IMMUTABLE=1 (snapshot w APP_ROOT/releases/).
#
# Użycie:
#   APP_ROOT=/ścieżka/do/repo bash scripts/rollback-to-release.sh 20260113_120000
# Opcjonalnie: DEPLOY_ECOSYSTEM, DEPLOY_PM2_ENV, ROLLBACK_CONFIRM=1
set -euo pipefail

APP_ROOT="${APP_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
REL_ROOT="${APP_ROOT}/releases"
ID="${1:-}"

if [[ "${ROLLBACK_CONFIRM:-0}" != "1" ]]; then
  echo "ERROR: ustaw ROLLBACK_CONFIRM=1 aby wykonać rollback (świadoma operacja na produkcji)." >&2
  exit 1
fi

if [[ -z "$ID" ]]; then
  echo "Usage: ROLLBACK_CONFIRM=1 $0 <release_id>" >&2
  echo "Dostępne katalogi w ${REL_ROOT}:" >&2
  ls -1t "$REL_ROOT" 2>/dev/null | head -20 >&2 || true
  exit 1
fi

SRC="${REL_ROOT}/${ID}"
if [[ ! -d "${SRC}/.next" ]]; then
  echo "ERROR: brak ${SRC}/.next — ten release nie ma snapshotu (sprawdź RELEASE_IMMUTABLE=1 przy deployu)." >&2
  exit 1
fi

DEPLOY_ECOSYSTEM="${DEPLOY_ECOSYSTEM:-ecosystem.config.cjs}"
DEPLOY_PM2_ENV="${DEPLOY_PM2_ENV:-production}"

cd "$APP_ROOT"
echo "==> rollback: ${SRC} -> .next (rsync)"
rm -rf .next
mkdir -p .next
rsync -a "${SRC}/.next/" .next/

if [[ -d "${SRC}/node_modules/.prisma" ]]; then
  echo "==> rollback: prisma client z release"
  mkdir -p node_modules/.prisma
  rsync -a "${SRC}/node_modules/.prisma/" node_modules/.prisma/
fi

echo "==> symlink releases/current -> ${ID}"
ln -sfn "${SRC}" "${REL_ROOT}/current"

echo "==> pm2 reload ${DEPLOY_ECOSYSTEM} env=${DEPLOY_PM2_ENV}"
pm2 reload "${DEPLOY_ECOSYSTEM}" --env "${DEPLOY_PM2_ENV}" --update-env
pm2 save

echo "Rollback zakończony. Smoke: SMOKE_BASE_URL=... node scripts/postdeploy-smoke.cjs"

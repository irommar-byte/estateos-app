#!/usr/bin/env bash
# Wgrywa patche z deploy/ na produkcję estateos.pl i przeładowuje PM2.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SSH_HOST="${ESTATEOS_SSH_HOST:-estateos}"
REMOTE="${ESTATEOS_REMOTE_DIR:-~/estateos}"

echo "→ Kopiowanie plików na ${SSH_HOST}:${REMOTE}"

scp -q "${ROOT}/deploy/plus-credit-fix/offers-route.ts" \
  "${SSH_HOST}:${REMOTE}/src/app/api/mobile/v1/offers/route.ts"

scp -q "${ROOT}/deploy/plus-credit-fix/offers-activate-route.ts" \
  "${SSH_HOST}:${REMOTE}/src/app/api/mobile/v1/offers/[offerId]/activate/route.ts"

scp -q "${ROOT}/deploy/plus-credit-fix/offerPublication.ts" \
  "${SSH_HOST}:${REMOTE}/src/lib/offerPublication.ts"

scp -q "${ROOT}/deploy/backend-admin-reports/route.ts" \
  "${SSH_HOST}:${REMOTE}/src/app/api/mobile/v1/admin/reports/route.ts"

scp -q "${ROOT}/deploy/backend-admin-reports/[id]/route.ts" \
  "${SSH_HOST}:${REMOTE}/src/app/api/mobile/v1/admin/reports/[id]/route.ts"

echo "→ build + pm2 reload"
ssh "${SSH_HOST}" "cd ${REMOTE} && npm run deploy:server-only"

echo "→ smoke (opcjonalnie)"
ssh "${SSH_HOST}" "cd ${REMOTE} && npm run smoke:postdeploy" || true

echo "✓ Deploy zakończony"

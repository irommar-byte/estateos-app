#!/usr/bin/env bash
# DEPRECATED (2026-05-25): nie używać — deploy tylko przez git (recovery-local-snapshot).
# Zobacz deploy/VPS_DEPLOY_WORKFLOW.md — git push → VPS: git pull && npm run deploy:server-only
# Wgrywa patche z deploy/ na produkcję estateos.pl i przeładowuje PM2 (SCP — wyłączone).
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

PROMO="${ROOT}/deploy/backend-profile-promo-cards"
ssh "${SSH_HOST}" "mkdir -p ${REMOTE}/src/app/api/mobile/v1/users/'[userId]'/promo-cards \
  ${REMOTE}/src/app/api/mobile/v1/me/promo-cards/'[cardId]' \
  ${REMOTE}/src/app/api/mobile/v1/admin/users/'[userId]'/promo-cards/notify"
scp -q "${PROMO}/profilePromoCards.ts" "${SSH_HOST}:${REMOTE}/src/lib/profilePromoCards.ts"
scp -q "${PROMO}/users-promo-cards-route.ts" \
  "${SSH_HOST}:${REMOTE}/src/app/api/mobile/v1/users/[userId]/promo-cards/route.ts"
scp -q "${PROMO}/me-promo-cards-route.ts" \
  "${SSH_HOST}:${REMOTE}/src/app/api/mobile/v1/me/promo-cards/route.ts"
scp -q "${PROMO}/me-promo-card-id-route.ts" \
  "${SSH_HOST}:${REMOTE}/src/app/api/mobile/v1/me/promo-cards/[cardId]/route.ts"
scp -q "${PROMO}/admin-promo-cards-route.ts" \
  "${SSH_HOST}:${REMOTE}/src/app/api/mobile/v1/admin/users/[userId]/promo-cards/route.ts"
scp -q "${PROMO}/admin-promo-cards-notify-route.ts" \
  "${SSH_HOST}:${REMOTE}/src/app/api/mobile/v1/admin/users/[userId]/promo-cards/notify/route.ts"

echo "→ build + pm2 reload"
ssh "${SSH_HOST}" "cd ${REMOTE} && npm run deploy:server-only"

echo "→ smoke (opcjonalnie)"
ssh "${SSH_HOST}" "cd ${REMOTE} && npm run smoke:postdeploy" || true

echo "✓ Deploy zakończony"

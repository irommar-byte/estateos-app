#!/usr/bin/env bash
# Geolokalizacja (fuzzy + UA), IAP Investor Pro subscription, import gaps API.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${ROOT}/deploy/estateos-www-full"
SSH_HOST="${ESTATEOS_SSH_HOST:-estateos}"
REMOTE="${ESTATEOS_REMOTE_DIR:-~/estateos}"

FILES=(
  "src/lib/location/locationNameMatch.ts"
  "src/lib/location/resolveOfferLocationFromCoordinates.ts"
  "src/lib/offerGeolocationValidate.ts"
  "src/lib/mobileIapEntitlements.ts"
  "src/lib/importDraftValidate.ts"
  "src/lib/otodomImportCreate.ts"
  "src/lib/services/offer.service.ts"
  "src/app/api/mobile/v1/iap/verify/route.ts"
  "src/app/api/mobile/v1/offers/route.ts"
  "src/app/api/mobile/v1/pro/otodom-import/create/route.ts"
)

for rel in "${FILES[@]}"; do
  if [[ ! -f "${SRC}/${rel}" ]]; then
    echo "Brak pliku: ${SRC}/${rel}"
    exit 1
  fi
  echo "→ ${rel}"
  scp -q "${SRC}/${rel}" "${SSH_HOST}:${REMOTE}/${rel}"
done

echo "→ build + pm2 reload"
ssh "${SSH_HOST}" "cd ${REMOTE} && npm run deploy:server-only"

echo "→ smoke"
ssh "${SSH_HOST}" "cd ${REMOTE} && npm run smoke:postdeploy" || true

echo "✓ Backend rollout wdrożony (geo + IAP + import)"

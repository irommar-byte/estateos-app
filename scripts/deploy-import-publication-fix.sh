#!/usr/bin/env bash
# Import Pro: opłacenie publikacji (atomowe) + parser Nieruchomosci (czynsz, ogrzewanie).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${ROOT}/deploy/estateos-www-full"
SSH_HOST="${ESTATEOS_SSH_HOST:-estateos}"
REMOTE="${ESTATEOS_REMOTE_DIR:-~/estateos}"

FILES=(
  "src/lib/otodomImportPublication.ts"
  "src/lib/otodomImport.ts"
  "src/lib/profilePromoCards.ts"
  "src/app/api/mobile/v1/pro/otodom-import/create/route.ts"
  "src/app/api/mobile/v1/me/promo-cards/route.ts"
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

echo "✓ Produkcja: import + opłacanie publikacji wdrożone"

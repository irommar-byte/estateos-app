#!/usr/bin/env bash
# IAP Investor Pro — backend verify + entitlements.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${ROOT}/deploy/estateos-www-full"
SSH_HOST="${ESTATEOS_SSH_HOST:-estateos}"
REMOTE="${ESTATEOS_REMOTE_DIR:-~/estateos}"

FILES=(
  "src/lib/mobileIapEntitlements.ts"
  "src/app/api/mobile/v1/iap/verify/route.ts"
)

for rel in "${FILES[@]}"; do
  echo "→ ${rel}"
  scp -q "${SRC}/${rel}" "${SSH_HOST}:${REMOTE}/${rel}"
done

echo "→ build + pm2 reload"
ssh "${SSH_HOST}" "cd ${REMOTE} && npm run deploy:server-only"
ssh "${SSH_HOST}" "cd ${REMOTE} && npm run smoke:postdeploy" || true
echo "✓ Investor Pro IAP backend wdrożony"

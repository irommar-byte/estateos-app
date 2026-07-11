#!/usr/bin/env bash
# EstateOS Studio — rollout API rezerwacji sesji zdjęciowych (mobile + admin).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${ROOT}/deploy/estateos-www-full"
SSH_HOST="${ESTATEOS_SSH_HOST:-estateos}"
REMOTE="${ESTATEOS_REMOTE_DIR:-~/estateos}"

FILES=(
  "prisma/schema.prisma"
  "prisma/migrations/20260711120000_photo_session_requests/migration.sql"
  "prisma/migrations/20260711143000_photo_session_negotiation/migration.sql"
  "src/lib/mobilePhotoSessionHandlers.ts"
  "src/lib/adminAttentionPush.ts"
  "src/app/api/mobile/v1/photo-sessions/route.ts"
  "src/app/api/mobile/v1/photo-sessions/[id]/respond/route.ts"
  "src/app/api/mobile/v1/admin/photo-sessions/route.ts"
)

for rel in "${FILES[@]}"; do
  if [[ ! -f "${SRC}/${rel}" ]]; then
    echo "Brak pliku: ${SRC}/${rel}"
    exit 1
  fi
  remote_dir="$(dirname "${REMOTE}/${rel}")"
  ssh "${SSH_HOST}" "mkdir -p \"\${HOME}/estateos/$(dirname "${rel}")\""
  echo "→ ${rel}"
  scp -q "${SRC}/${rel}" "${SSH_HOST}:estateos/${rel}"
done

echo "→ prisma migrate deploy"
ssh "${SSH_HOST}" "cd ~/estateos && npx prisma migrate deploy"

echo "→ build + pm2 reload"
ssh "${SSH_HOST}" "cd ~/estateos && npm run deploy:server-only"

echo "→ smoke photo-sessions endpoint"
code="$(curl -s -o /dev/null -w '%{http_code}' -X POST https://estateos.pl/api/mobile/v1/photo-sessions -H 'Content-Type: application/json' -d '{}' || true)"
echo "POST /api/mobile/v1/photo-sessions → HTTP ${code} (401 bez tokena = OK, 404 = brak deployu)"

echo "✓ Photo sessions API rollout zakończony"

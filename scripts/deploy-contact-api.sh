#!/usr/bin/env bash
# EstateOS™ Contact — pełny rollout API na produkcję (threads, messages, reactions, delete).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${ROOT}/deploy/estateos-www-full"
SSH_HOST="${ESTATEOS_SSH_HOST:-estateos}"
REMOTE="${ESTATEOS_REMOTE_DIR:-~/estateos}"

FILES=(
  "prisma/schema.prisma"
  "src/lib/contactThreadPair.ts"
  "src/lib/mobileAuthUserId.ts"
  "src/lib/contactMessageReactions.ts"
  "src/app/api/mobile/v1/contact/threads/route.ts"
  "src/app/api/mobile/v1/contact/threads/[id]/route.ts"
  "src/app/api/mobile/v1/contact/threads/[id]/messages/route.ts"
  "src/app/api/mobile/v1/contact/threads/[id]/messages/[messageId]/reaction/route.ts"
  "src/app/api/mobile/v1/contact/threads/[id]/typing/route.ts"
)

for rel in "${FILES[@]}"; do
  if [[ ! -f "${SRC}/${rel}" ]]; then
    echo "Brak pliku: ${SRC}/${rel}"
    exit 1
  fi
  remote_dir="$(dirname "${REMOTE}/${rel}")"
  ssh "${SSH_HOST}" "mkdir -p '${remote_dir}'"
  echo "→ ${rel}"
  scp -q "${SRC}/${rel}" "${SSH_HOST}:${REMOTE}/${rel}"
done

echo "→ build + pm2 reload"
ssh "${SSH_HOST}" "cd ${REMOTE} && npm run deploy:server-only"

echo "→ smoke contact endpoints"
threads_code="$(curl -s -o /dev/null -w '%{http_code}' https://estateos.pl/api/mobile/v1/contact/threads || true)"
echo "GET /api/mobile/v1/contact/threads → HTTP ${threads_code} (401 bez tokena = OK, 404 = brak deployu)"

echo "✓ Contact API rollout zakończony"

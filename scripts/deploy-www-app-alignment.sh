#!/usr/bin/env bash
# Wgrywa wyrównanie WWW do aplikacji mobilnej (auth, hero, tryb użytkownika) na estateos.pl
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${ROOT}/deploy/estateos-www-full"
SSH_HOST="${ESTATEOS_SSH_HOST:-estateos}"
REMOTE="${ESTATEOS_REMOTE_DIR:-~/estateos}"

if [[ ! -d "${SRC}/src" ]]; then
  echo "Brak ${SRC} — uruchom: rsync -az --exclude node_modules --exclude .next estateos:~/estateos/ deploy/estateos-www-full/"
  exit 1
fi

echo "→ Kopiowanie plików WWW na ${SSH_HOST}:${REMOTE}"

FILES=(
  "src/components/auth/RegisterForm.tsx"
  "src/app/rejestracja/page.tsx"
  "src/app/login/page.tsx"
  "src/contracts/homeCtaContract.ts"
  "src/components/hero3d/HeroDepthEffect.tsx"
  "src/i18n/dictionaries.ts"
  "src/contexts/UserModeContext.tsx"
  "src/components/ui/PremiumModeToggle.tsx"
  "src/components/ui/ModeTransition.tsx"
  "src/components/ui/WorkspaceSwitcher.tsx"
  "src/app/moje-konto/crm/page.tsx"
  "src/app/api/register/route.ts"
)

for rel in "${FILES[@]}"; do
  scp -q "${SRC}/${rel}" "${SSH_HOST}:${REMOTE}/${rel}"
done

echo "→ Usuwanie legacy HeroDepthEffect.v1 (blokuje build)"
ssh "${SSH_HOST}" "rm -f ${REMOTE}/src/components/hero3d/HeroDepthEffect.v1.tsx"

echo "→ build + pm2 reload"
ssh "${SSH_HOST}" "cd ${REMOTE} && npm run deploy:server-only"

echo "→ smoke"
ssh "${SSH_HOST}" "cd ${REMOTE} && npm run smoke:postdeploy" || true

echo "✓ WWW alignment deploy zakończony"

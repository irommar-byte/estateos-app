#!/usr/bin/env bash
# EstateOS™ — główny entrypoint deployu produkcyjnego.
# GitHub = source of truth; PM2 reload + --update-env = standardowy rollout.
# Nie logujemy sekretów (.env tylko na serwerze, chmod 600).
#
# Zmienne opcjonalne:
#   APP_ROOT, SKIP_BACKUP=1, SKIP_SOURCE_SNAPSHOT=1, SMOKE_BASE_URL,
#   MONITOR_LOG_LINES (domyślnie 50), PM2_APP (domyślnie nieruchomosci)
#
# Po nieudanym deployu: skrypt wypisuje diagnozę i gotowe kroki rollbacku
# (git reset --hard do commita sprzed pull + przebudowa + pm2 reload).
# Nie wykonujemy rollbacku automatycznie — unikamy „cichej” zmiany prod.

set -euo pipefail

APP_ROOT="${APP_ROOT:-/home/rommar/estateos}"
PM2_APP="${PM2_APP:-nieruchomosci}"
SMOKE_BASE_URL="${SMOKE_BASE_URL:-http://127.0.0.1:3000}"
SKIP_BACKUP="${SKIP_BACKUP:-0}"
SKIP_SOURCE_SNAPSHOT="${SKIP_SOURCE_SNAPSHOT:-0}"
MONITOR_LOG_LINES="${MONITOR_LOG_LINES:-50}"

RECOVER_DIR="$APP_ROOT/.deploy/recovery"
STAMP="$(date +%Y%m%d_%H%M%S)"
PRE_PULL_COMMIT_FILE="$RECOVER_DIR/pre_pull_commit"
LAST_SUCCESS_FILE="$RECOVER_DIR/last_success_commit"

cd "$APP_ROOT"

mkdir -p "$RECOVER_DIR"

deploy_failed() {
  local code=$?
  trap - ERR
  echo "" >&2
  echo "============================================================" >&2
  echo " DEPLOY FAILED — rollout zatrzymany (exit code ${code})" >&2
  echo "============================================================" >&2
  echo "Ostatnia komenda (BASH): ${BASH_COMMAND:-?}" >&2
  echo "" >&2

  if command -v pm2 >/dev/null 2>&1; then
    echo "--- pm2 list ---" >&2
    pm2 list 2>&1 | head -40 >&2 || true
    echo "" >&2
    echo "--- pm2 logs ${PM2_APP} (ostatnie ${MONITOR_LOG_LINES} linii, --nostream) ---" >&2
    pm2 logs "$PM2_APP" --lines "$MONITOR_LOG_LINES" --nostream 2>&1 | tail -n "$MONITOR_LOG_LINES" >&2 || true
  else
    echo "(pm2 nie znaleziony w PATH — pomijam logi)" >&2
  fi

  echo "" >&2
  echo "--- Rollback readiness (nie wykonujemy auto-rollbacku) ---" >&2
  if [[ -f "$PRE_PULL_COMMIT_FILE" ]]; then
    local old_commit
    old_commit="$(tr -d ' \n\r' <"$PRE_PULL_COMMIT_FILE")"
    echo "Commit sprzed git pull dla tego deployu: ${old_commit}" >&2
    echo "Przykładowy rollback (WYKONAJ RĘCZNIE po weryfikacji):" >&2
    echo "  cd \"$APP_ROOT\"" >&2
    echo "  git reset --hard ${old_commit}" >&2
    echo "  npm ci && npx prisma generate && npm run build" >&2
    echo "  pm2 reload ecosystem.config.cjs --env production --update-env && pm2 save" >&2
    echo "  SMOKE_BASE_URL=${SMOKE_BASE_URL} node scripts/postdeploy-smoke.cjs" >&2
  else
    echo "Brak pliku pre_pull_commit — nie można bezpiecznie podać SHA rollbacku z tego skryptu." >&2
  fi

  if [[ -f "$LAST_SUCCESS_FILE" ]]; then
    echo "Ostatni zapisany sukces deployu (poprzednia sesja): $(tr -d ' \n\r' <"$LAST_SUCCESS_FILE")" >&2
  fi

  echo "" >&2
  echo "Sprawdź także: tail błędów builda powyżej, stan MySQL, miejsce na dysku, NODE/npm." >&2
  exit "$code"
}

trap 'deploy_failed' ERR

if [[ ! -f .env ]]; then
  echo "ERROR: $APP_ROOT/.env missing. Restore from secure backup before deploy." >&2
  exit 1
fi

echo "==> recovery: zapis commita sprzed pull (rollback readiness)"
git rev-parse HEAD >"$PRE_PULL_COMMIT_FILE"

if [[ "$SKIP_SOURCE_SNAPSHOT" != "1" ]]; then
  echo "==> recovery: snapshot źródeł (tar, bez node_modules/.next)"
  shopt -s nullglob
  next_cfgs=(next.config.js next.config.mjs next.config.ts)
  tar -czf "$RECOVER_DIR/source_${STAMP}.tgz" \
    src prisma public package.json package-lock.json ecosystem.config.cjs \
    scripts "${next_cfgs[@]}" 2>/dev/null || {
    echo "WARN: tar snapshot częściowo nieudany (sprawdź ścieżki)." >&2
  }
fi

echo "==> verify prod env (przed deployem)"
APP_ROOT="$APP_ROOT" node "$APP_ROOT/scripts/verify-prod-env.cjs"

if [[ "$SKIP_BACKUP" != "1" ]]; then
  echo "==> DB backup"
  APP_ROOT="$APP_ROOT" node "$APP_ROOT/scripts/backup-db.cjs"
else
  echo "==> DB backup skipped (SKIP_BACKUP=1)"
fi

echo "==> git pull --ff-only"
git pull --ff-only

echo "==> npm ci"
npm ci

echo "==> prisma generate"
npx prisma generate

echo "==> build"
npm run build

echo "==> pm2 reload (--update-env)"
pm2 reload ecosystem.config.cjs --env production --update-env
pm2 save

echo "==> verify prod env (po reloadzie — plik .env)"
APP_ROOT="$APP_ROOT" node "$APP_ROOT/scripts/verify-prod-env.cjs"

echo "==> smoke ($SMOKE_BASE_URL)"
SMOKE_BASE_URL="$SMOKE_BASE_URL" node "$APP_ROOT/scripts/postdeploy-smoke.cjs"

echo "==> healthcheck (curl)"
health_code="$(curl -sS -o /dev/null -w '%{http_code}' "${SMOKE_BASE_URL}/api/health" || echo ERR)"
if [[ "$health_code" != "200" ]]; then
  echo "ERROR: healthcheck HTTP ${health_code} (oczekiwano 200)" >&2
  exit 1
fi

echo "==> pm2 monitoring (ostatnie ${MONITOR_LOG_LINES} linii, --nostream)"
pm2 logs "$PM2_APP" --lines "$MONITOR_LOG_LINES" --nostream 2>&1 | tail -n "$MONITOR_LOG_LINES" || true

git rev-parse HEAD >"$LAST_SUCCESS_FILE"
trap - ERR

echo ""
echo "Deploy finished OK. Zapisano last_success_commit: $(tr -d ' \n\r' <"$LAST_SUCCESS_FILE")"

#!/usr/bin/env bash
# EstateOS™ — główny entrypoint deployu produkcyjnego (DevOps operator).
# GitHub = source of truth; PM2 reload + --update-env = standardowy rollout.
# Nie logujemy sekretów (.env tylko na serwerze, chmod 600).
#
# Zmienne opcjonalne:
#   APP_ROOT, SKIP_BACKUP=1, SKIP_SOURCE_SNAPSHOT=1, SMOKE_BASE_URL,
#   MONITOR_LOG_LINES (domyślnie 50), PM2_APP (domyślnie nieruchomosci),
#   DEPLOY_ALLOW_DIRTY=1 — kontynuuj mimo zmian w śledzonych plikach względem HEAD,
#   SKIP_PREFLIGHT=1 — pomiń blok diagnostyczny (niezalecane na prod),
#   CURL_INSECURE=1 — curl -k dla self-signed na SMOKE_BASE_URL.
#
# Po nieudanym deployu: trap ERR — rollout zatrzymany, PM2, rollback SHA, snapshoty.
# Automatycznego git reset --hard nie wykonujemy (świadomy rollback po diagnozie).

set -euo pipefail

APP_ROOT="${APP_ROOT:-/home/rommar/estateos}"
PM2_APP="${PM2_APP:-nieruchomosci}"
SMOKE_BASE_URL="${SMOKE_BASE_URL:-http://127.0.0.1:3000}"
SKIP_BACKUP="${SKIP_BACKUP:-0}"
SKIP_SOURCE_SNAPSHOT="${SKIP_SOURCE_SNAPSHOT:-0}"
SKIP_PREFLIGHT="${SKIP_PREFLIGHT:-0}"
MONITOR_LOG_LINES="${MONITOR_LOG_LINES:-50}"
CURL_INSECURE="${CURL_INSECURE:-0}"

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
    echo "--- pm2 describe ${PM2_APP} (skrót) ---" >&2
    pm2 describe "$PM2_APP" 2>&1 | head -45 >&2 || true
    echo "" >&2
    echo "--- pm2 logs ${PM2_APP} (ostatnie ${MONITOR_LOG_LINES} linii, --nostream) ---" >&2
    pm2 logs "$PM2_APP" --lines "$MONITOR_LOG_LINES" --nostream 2>&1 | tail -n "$MONITOR_LOG_LINES" >&2 || true
  else
    echo "(pm2 nie znaleziony w PATH — pomijam logi)" >&2
  fi

  echo "" >&2
  echo "--- Recovery snapshots (.tgz w ${RECOVER_DIR}) ---" >&2
  ls -1t "$RECOVER_DIR"/source_*.tgz 2>/dev/null | head -5 >&2 || echo "(brak plików source_*.tgz)" >&2

  echo "" >&2
  echo "--- Rollback readiness (wykonaj ręcznie po weryfikacji) ---" >&2
  if [[ -f "$PRE_PULL_COMMIT_FILE" ]]; then
    local old_commit
    old_commit="$(tr -d ' \n\r' <"$PRE_PULL_COMMIT_FILE")"
    echo "Commit sprzed git pull dla tego deployu: ${old_commit}" >&2
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
  echo "Dalsza diagnoza: log builda powyżej, MySQL, miejsce na dysku (df -h), wersje node/npm." >&2
  exit "$code"
}

curl_deploy() {
  local args=(-sS -o /dev/null -w '%{http_code}')
  if [[ "$CURL_INSECURE" == "1" ]]; then
    args+=(-k)
  fi
  curl "${args[@]}" "$@"
}

preflight_prod() {
  echo ""
  echo "========== PREFLIGHT =========="
  echo "hostname: $(hostname -f 2>/dev/null || hostname)"
  echo "pwd: $(pwd)"
  echo "APP_ROOT: ${APP_ROOT}"
  echo "user: $(id -un 2>/dev/null || true) ($(id -u 2>/dev/null || true))"

  if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "ERROR: katalog nie jest repozytorium git — najpierw recovery (clone/fetch), potem deploy." >&2
    exit 1
  fi

  local branch upstream
  branch="$(git branch --show-current 2>/dev/null || echo "?")"
  upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || echo "(brak upstream)")"
  echo "git branch: ${branch}"
  echo "git upstream: ${upstream}"
  echo "--- git status ---"
  git status -sb || true

  echo "--- pm2 list ---"
  if command -v pm2 >/dev/null 2>&1; then
    pm2 list || echo "WARN: pm2 list zwrócił błąd" >&2
  else
    echo "WARN: brak pm2 w PATH — etap reload się nie powiedzie." >&2
  fi

  if [[ ! -f package.json ]]; then
    echo "ERROR: brak package.json w ${APP_ROOT}" >&2
    exit 1
  fi
  if [[ ! -f package-lock.json ]]; then
    echo "WARN: brak package-lock.json — npm ci może się nie powieść." >&2
  fi

  echo "--- verify-prod-env ---"
  APP_ROOT="$APP_ROOT" node "$APP_ROOT/scripts/verify-prod-env.cjs"

  echo "--- czystość śledzonych plików (vs HEAD) ---"
  if ! git diff-index --quiet HEAD -- 2>/dev/null; then
    echo "ERROR: wykryto zmiany w śledzonych plikach względem HEAD (nie commituj deployu z „brudnego” drzewa na prod)." >&2
    git diff-index --name-only HEAD | head -30 >&2
    if [[ "${DEPLOY_ALLOW_DIRTY:-0}" != "1" ]]; then
      echo "Ustaw DEPLOY_ALLOW_DIRTY=1 tylko po świadomej decyzji." >&2
      exit 1
    fi
    echo "WARN: DEPLOY_ALLOW_DIRTY=1 — kontynuacja mimo brudu." >&2
  else
    echo "OK: brak lokalnych modyfikacji śledzonych plików vs HEAD."
  fi

  echo "--- stan katalogu .next ---"
  if [[ -d .next ]]; then
    echo "OK: .next istnieje ($(du -sh .next 2>/dev/null | awk '{print $1}' || echo '?'))"
  else
    echo "INFO: brak .next — pierwszy build w tej sesji utworzy katalog."
  fi

  echo "========== PREFLIGHT OK =========="
  echo ""
}

post_deploy_verify() {
  echo "==> post-deploy: HTTP (${SMOKE_BASE_URL})"
  local p code
  for p in /api/health /.well-known/assetlinks.json /.well-known/apple-app-site-association; do
    code="$(curl_deploy "${SMOKE_BASE_URL}${p}" || echo ERR)"
    echo "  ${p} -> HTTP ${code}"
    if [[ "$code" != "200" ]]; then
      echo "ERROR: oczekiwano 200 dla ${p}, otrzymano ${code}" >&2
      return 1
    fi
  done

  echo "==> post-deploy: pm2 describe ${PM2_APP}"
  if command -v pm2 >/dev/null 2>&1; then
    pm2 describe "$PM2_APP" 2>/dev/null | head -40 || true
  fi
}

if [[ ! -f .env ]]; then
  echo "ERROR: $APP_ROOT/.env missing. Przywróć z backupu przed deployem." >&2
  exit 1
fi

if [[ "$SKIP_PREFLIGHT" != "1" ]]; then
  preflight_prod
else
  echo "WARN: SKIP_PREFLIGHT=1 — pominięto preflight (niezalecane na produkcji)." >&2
fi

trap 'deploy_failed' ERR

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

echo "==> verify prod env (po reloadzie)"
APP_ROOT="$APP_ROOT" node "$APP_ROOT/scripts/verify-prod-env.cjs"

echo "==> smoke (${SMOKE_BASE_URL})"
SMOKE_BASE_URL="$SMOKE_BASE_URL" node "$APP_ROOT/scripts/postdeploy-smoke.cjs"

echo "==> healthcheck (curl)"
health_code="$(curl_deploy "${SMOKE_BASE_URL}/api/health" || echo ERR)"
if [[ "$health_code" != "200" ]]; then
  echo "ERROR: healthcheck HTTP ${health_code} (oczekiwano 200)" >&2
  exit 1
fi

post_deploy_verify

echo "==> pm2 monitoring (ostatnie ${MONITOR_LOG_LINES} linii, --nostream)"
pm2 logs "$PM2_APP" --lines "$MONITOR_LOG_LINES" --nostream 2>&1 | tail -n "$MONITOR_LOG_LINES" || true

git rev-parse HEAD >"$LAST_SUCCESS_FILE"
trap - ERR

echo ""
echo "Deploy finished OK. last_success_commit: $(tr -d ' \n\r' <"$LAST_SUCCESS_FILE")"

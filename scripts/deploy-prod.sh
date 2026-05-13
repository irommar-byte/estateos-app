#!/usr/bin/env bash
# EstateOS™ — główny entrypoint deployu produkcyjnego (DevOps operator).
# GitHub = source of truth; PM2 reload + --update-env = standardowy rollout.
# Nie logujemy sekretów (.env tylko na serwerze, chmod 600).
#
# Zmienne opcjonalne:
#   APP_ROOT, SKIP_BACKUP=1, SKIP_SOURCE_SNAPSHOT=1, SMOKE_BASE_URL,
#   MONITOR_LOG_LINES (domyślnie 50), PM2_APP (domyślnie nieruchomosci),
#   DEPLOY_ECOSYSTEM (domyślnie ecosystem.config.cjs),
#   DEPLOY_PM2_ENV (domyślnie production — staging: staging),
#   DEPLOY_ENV_FILE (domyślnie ${APP_ROOT}/.env — staging: .env.staging),
#   DEPLOY_ALLOW_DIRTY=1, SKIP_PREFLIGHT=1, CURL_INSECURE=1
#   DEPLOY_SKIP_DEPLOY_LOCK=1 — pomiń lock (tylko świadomie; staging i tak go nie używa)
#   DEPLOY_LOCK_FILE, DEPLOY_LOCK_MAX_AGE_SEC (domyślnie 7200), DEPLOY_LOCK_TRIGGER (np. local|npm-release|github-actions)
#
# Metryki + historia: .deploy/deploy-history.jsonl | powiadomienia: scripts/notify-deploy.cjs (DISCORD_WEBHOOK_URL / SLACK_WEBHOOK_URL).
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
DEPLOY_ECOSYSTEM="${DEPLOY_ECOSYSTEM:-ecosystem.config.cjs}"
DEPLOY_PM2_ENV="${DEPLOY_PM2_ENV:-production}"
DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-${APP_ROOT}/.env}"
RELEASE_IMMUTABLE="${RELEASE_IMMUTABLE:-0}"
RECOVER_DIR="$APP_ROOT/.deploy/recovery"
DEPLOY_LOCK_FILE="${DEPLOY_LOCK_FILE:-${APP_ROOT}/.deploy/deploy.lock}"
DEPLOY_LOCK_MAX_AGE_SEC="${DEPLOY_LOCK_MAX_AGE_SEC:-7200}"
STAMP="$(date +%Y%m%d_%H%M%S)"
REL_ROOT="${APP_ROOT}/releases"
RELEASE_ID="${STAMP}"
REL_DIR="${REL_ROOT}/${RELEASE_ID}"
PRE_PULL_COMMIT_FILE="$RECOVER_DIR/pre_pull_commit"
LAST_SUCCESS_FILE="$RECOVER_DIR/last_success_commit"

cd "$APP_ROOT" || exit 1

mkdir -p "$RECOVER_DIR"
DEPLOY_T0="$(date +%s)"
DEPLOY_LOCK_HELD=0

deploy_notify_and_record() {
  local kind="$1"
  local exit_code="${2:-0}"
  local duration=$(( $(date +%s) - DEPLOY_T0 ))
  local sha branch rb hint
  sha="$(git rev-parse HEAD 2>/dev/null || echo unknown)"
  branch="$(git branch --show-current 2>/dev/null || echo unknown)"
  rb=""
  if [[ -f "$PRE_PULL_COMMIT_FILE" ]]; then
    rb="$(tr -d ' \n\r' <"$PRE_PULL_COMMIT_FILE")"
  fi
  hint="cd \"${APP_ROOT}\" && git reset --hard ${rb} && npm ci && npx prisma generate && npm run build && pm2 reload ${DEPLOY_ECOSYSTEM} --env ${DEPLOY_PM2_ENV} --update-env && pm2 save"
sleep 12
  if [[ "${RELEASE_IMMUTABLE}" == "1" && -d "${REL_DIR}/.next" ]]; then
    hint="${hint} | artifact rollback: ROLLBACK_CONFIRM=1 bash scripts/rollback-to-release.sh ${RELEASE_ID}"
  fi
  export DEPLOY_STATUS="$kind" DEPLOY_EXIT="$exit_code" DEPLOY_DURATION_SEC="$duration" \
    DEPLOY_SHA="$sha" DEPLOY_BRANCH="$branch" DEPLOY_ROLLBACK_SHA="$rb" DEPLOY_ROLLBACK_HINT="$hint" \
    DEPLOY_ECOSYSTEM="$DEPLOY_ECOSYSTEM" DEPLOY_HOSTNAME="$(hostname -f 2>/dev/null || hostname)" \
    DEPLOY_URL="${DEPLOY_URL:-https://estateos.pl}" \
    DEPLOY_RELEASE_ID="${DEPLOY_RELEASE_ID:-}" DEPLOY_RELEASE_IMMUTABLE="${DEPLOY_RELEASE_IMMUTABLE:-0}"
  node "$APP_ROOT/scripts/record-deploy-metadata.cjs" || true
  node "$APP_ROOT/scripts/notify-deploy.cjs" || true
}

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
    echo "  pm2 reload ${DEPLOY_ECOSYSTEM} --env ${DEPLOY_PM2_ENV} --update-env && pm2 save" >&2
sleep 12
    echo "  SMOKE_BASE_URL=${SMOKE_BASE_URL} node scripts/postdeploy-smoke.cjs" >&2
  else
    echo "Brak pliku pre_pull_commit — nie można bezpiecznie podać SHA rollbacku z tego skryptu." >&2
  fi

  if [[ -f "$LAST_SUCCESS_FILE" ]]; then
    echo "Ostatni zapisany sukces deployu (poprzednia sesja): $(tr -d ' \n\r' <"$LAST_SUCCESS_FILE")" >&2
  fi

  echo "" >&2
  echo "Dalsza diagnoza: log builda powyżej, MySQL, miejsce na dysku (df -h), wersje node/npm." >&2

  deploy_notify_and_record failure "$code" || true
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
  echo "DEPLOY_ENV_FILE: ${DEPLOY_ENV_FILE}"
  echo "DEPLOY_ECOSYSTEM: ${DEPLOY_ECOSYSTEM} (PM2 env: ${DEPLOY_PM2_ENV})"
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
  DEPLOY_ENV_FILE="$DEPLOY_ENV_FILE" APP_ROOT="$APP_ROOT" node "$APP_ROOT/scripts/verify-prod-env.cjs"

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

deploy_lock_field() {
  local f="$1" key="$2"
  [[ -f "$f" ]] || { echo ""; return; }
  grep "^${key}=" "$f" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r'
}

# Zwraca 0 gdy lock jest „stary” (można usunąć): brak pliku, zły format, martwy PID lub wiek > DEPLOY_LOCK_MAX_AGE_SEC.
deploy_lock_is_stale() {
  local f="$1" lpid started_epoch now age max
  max="${DEPLOY_LOCK_MAX_AGE_SEC}"
  [[ -f "$f" ]] || return 0
  lpid="$(deploy_lock_field "$f" pid)"
  started_epoch="$(deploy_lock_field "$f" started_epoch)"
  if ! [[ "${lpid}" =~ ^[0-9]+$ ]]; then
    return 0
  fi
  if ! [[ "${started_epoch}" =~ ^[0-9]+$ ]]; then
    return 0
  fi
  now="$(date +%s)"
  age=$((now - started_epoch))
  if [[ "${age}" -gt "${max}" ]]; then
    return 0
  fi
  if kill -0 "${lpid}" 2>/dev/null; then
    return 1
  fi
  return 0
}

deploy_lock_print_busy() {
  local f="$1"
  echo "" >&2
  echo "============================================================" >&2
  echo " DEPLOY LOCK — zajęty (inny deploy produkcji trwa)" >&2
  echo " Plik: ${f}" >&2
  echo "============================================================" >&2
  if [[ -f "$f" ]]; then
    echo "Kto / od kiedy / jaki SHA (deploy.lock):" >&2
    sed -n '1,120p' "$f" >&2 || true
  fi
  echo "" >&2
  echo "Poczekaj na koniec deployu. Lock jest zwalniany automatycznie (EXIT). Stale: martwy PID lub wiek > ${DEPLOY_LOCK_MAX_AGE_SEC}s." >&2
}

deploy_lock_write_body() {
  local sha branch host user ppid trig started_epoch started_iso
  sha="$(git rev-parse HEAD 2>/dev/null || echo unknown)"
  branch="$(git branch --show-current 2>/dev/null || echo unknown)"
  host="$(hostname -f 2>/dev/null || hostname)"
  user="$(id -un 2>/dev/null || echo unknown)"
  ppid="${PPID:-0}"
  trig="${DEPLOY_LOCK_TRIGGER:-local}"
  started_epoch="$(date +%s)"
  started_iso="$(date -Is 2>/dev/null || date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf '%s\n' \
    'v=1' \
    "pid=$$" \
    "ppid=${ppid}" \
    "started_epoch=${started_epoch}" \
    "started_iso=${started_iso}" \
    "sha=${sha}" \
    "branch=${branch}" \
    "hostname=${host}" \
    "user=${user}" \
    "trigger=${trig}" \
    "lock_file=${DEPLOY_LOCK_FILE}"
}

deploy_lock_acquire() {
  if [[ "${DEPLOY_SKIP_DEPLOY_LOCK:-0}" == "1" ]]; then
    echo "WARN: DEPLOY_SKIP_DEPLOY_LOCK=1 — deploy lock wyłączony (produkcja)." >&2
    return 0
  fi
  if [[ "${DEPLOY_PM2_ENV:-production}" == "staging" ]]; then
    return 0
  fi
  mkdir -p "$(dirname "${DEPLOY_LOCK_FILE}")"
  local attempt=0 max_attempts=12
  while [[ "${attempt}" -lt "${max_attempts}" ]]; do
    if [[ -f "${DEPLOY_LOCK_FILE}" ]]; then
      if deploy_lock_is_stale "${DEPLOY_LOCK_FILE}"; then
        echo "WARN: deploy.lock przeterminowany lub martwy PID — usuwam: ${DEPLOY_LOCK_FILE}" >&2
        rm -f "${DEPLOY_LOCK_FILE}"
      else
        deploy_lock_print_busy "${DEPLOY_LOCK_FILE}"
        exit 17
      fi
    fi
    if ( set -C; deploy_lock_write_body >"${DEPLOY_LOCK_FILE}" ) 2>/dev/null; then
      DEPLOY_LOCK_HELD=1
      echo "==> deploy lock: OK (PID $$, ${DEPLOY_LOCK_FILE})"
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 1
  done
  echo "ERROR: nie udało się utworzyć deploy.lock (kolizja / race po ${max_attempts} próbach)." >&2
  exit 17
}

deploy_lock_release() {
  if [[ "${DEPLOY_LOCK_HELD}" != "1" ]]; then
    return 0
  fi
  if [[ ! -f "${DEPLOY_LOCK_FILE}" ]]; then
    DEPLOY_LOCK_HELD=0
    return 0
  fi
  local owner
  owner="$(deploy_lock_field "${DEPLOY_LOCK_FILE}" pid)"
  if [[ "${owner}" == "$$" ]]; then
    rm -f "${DEPLOY_LOCK_FILE}"
  else
    echo "WARN: nie usuwam deploy.lock — pid w pliku (${owner}) != bieżący $$" >&2
  fi
  DEPLOY_LOCK_HELD=0
}

deploy_lock_on_exit() {
  deploy_lock_release
}

trap 'deploy_lock_on_exit' EXIT

if [[ ! -f "${DEPLOY_ENV_FILE}" ]]; then
  echo "ERROR: brak pliku env: ${DEPLOY_ENV_FILE}" >&2
  exit 1
fi

deploy_lock_acquire

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
  eco_extra=()
  if [[ -f "${APP_ROOT}/${DEPLOY_ECOSYSTEM}" ]]; then
    eco_extra+=("${DEPLOY_ECOSYSTEM}")
  fi
  if [[ -f "${APP_ROOT}/ecosystem.staging.config.cjs" ]]; then
    eco_extra+=("ecosystem.staging.config.cjs")
  fi
  tar -czf "$RECOVER_DIR/source_${STAMP}.tgz" \
    src prisma public package.json package-lock.json ecosystem.config.cjs \
    scripts "${eco_extra[@]}" "${next_cfgs[@]}" 2>/dev/null || {
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

snapshot_release_artifacts() {
  export DEPLOY_RELEASE_ID="" DEPLOY_RELEASE_IMMUTABLE="0"
  if [[ "${RELEASE_IMMUTABLE}" != "1" ]]; then
    return 0
  fi
  if ! command -v rsync >/dev/null 2>&1; then
    echo "ERROR: RELEASE_IMMUTABLE=1 wymaga rsync w PATH" >&2
    return 1
  fi
  echo "==> immutable release snapshot -> ${REL_DIR} (rsync .next; duże zużycie dysku)"
  mkdir -p "${REL_DIR}"
  rsync -a --delete .next/ "${REL_DIR}/.next/"
  if [[ -d node_modules/.prisma ]]; then
    mkdir -p "${REL_DIR}/node_modules"
    rsync -a node_modules/.prisma/ "${REL_DIR}/node_modules/.prisma/"
  fi
  branch="$(git branch --show-current 2>/dev/null || echo unknown)"
  sha="$(git rev-parse HEAD 2>/dev/null || echo unknown)"
  printf '%s\n' "{\"id\":\"${RELEASE_ID}\",\"sha\":\"${sha}\",\"branch\":\"${branch}\",\"createdAt\":\"$(date -Iseconds)\"}" >"${REL_DIR}/META.json"
  ln -sfn "${REL_DIR}" "${REL_ROOT}/current"
  export DEPLOY_RELEASE_ID="$RELEASE_ID" DEPLOY_RELEASE_IMMUTABLE="1"
  echo "OK: releases/current -> ${RELEASE_ID}"
}

snapshot_release_artifacts

echo "==> pm2 reload (--update-env) ${DEPLOY_ECOSYSTEM} env=${DEPLOY_PM2_ENV}"
sleep 12
pm2 reload "${DEPLOY_ECOSYSTEM}" --env "${DEPLOY_PM2_ENV}" --update-env
sleep 12
pm2 save

echo "==> verify prod env (po reloadzie)"
DEPLOY_ENV_FILE="$DEPLOY_ENV_FILE" APP_ROOT="$APP_ROOT" node "$APP_ROOT/scripts/verify-prod-env.cjs"

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

deploy_notify_and_record success 0

echo ""
echo "Deploy finished OK. last_success_commit: $(tr -d ' \n\r' <"$LAST_SUCCESS_FILE")"

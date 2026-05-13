#!/usr/bin/env bash
# EstateOS™ — single-command production release: status → (auto-commit) → push → deploy:prod → raport.
#
# Uruchom z katalogu repo lub ustaw APP_ROOT. Zakłada **ten sam host** ma prawo `git push` do origin
# oraz uruchamia `deploy:prod` (pull + build + PM2) — typowy serwer aplikacji z kluczem SSH do GitHuba.
#
# Zmienne:
#   RELEASE_AUTO_COMMIT=1     — jeśli working tree nieczysty: git add -A + commit (bez śledzonego .env)
#   RELEASE_SKIP_PUSH=1       — pomiń push (np. po ręcznym pushu; tylko deploy)
#   RELEASE_SKIP_PREBUILD=1   — pomiń npm run type-check + build przed pushem (niezalecane)
#   RELEASE_SKIP_PROD_CURL=1  — pomiń zewnętrzne curle na PROD_URL (np. brak trasy z serwera do CDN)
#   PROD_URL=https://estateos.pl — dodatkowe curle publiczne w raporcie (domyślnie ta domena)
#   SMOKE_BASE_URL, PM2_APP — przekazywane do deploy-prod.sh
#   DEPLOY_LOCK_TRIGGER — opcjonalnie; domyślnie npm-release przy kroku deploy (wpis w .deploy/deploy.lock)
#
# Brak auto-recover / reset — przy błędzie: komunikat, SHA rollback, stop.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="${APP_ROOT:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
PM2_APP="${PM2_APP:-nieruchomosci}"
PROD_URL="${PROD_URL:-https://estateos.pl}"
SMOKE_BASE_URL="${SMOKE_BASE_URL:-http://127.0.0.1:3000}"
RECOVER_DIR="${APP_ROOT}/.deploy/recovery"
REPORT_FILE="${RELEASE_REPORT_PATH:-${APP_ROOT}/scripts/.release-report.txt}"
PRE_RELEASE_FILE="${RECOVER_DIR}/pre_release_head"

cd "${APP_ROOT}"

mkdir -p "${RECOVER_DIR}"
git rev-parse HEAD >"${PRE_RELEASE_FILE}"

release_failed() {
  local code=$?
  trap - ERR
  echo "" >&2
  echo "============================================================" >&2
  echo " RELEASE FAILED (exit ${code})" >&2
  echo "============================================================" >&2
  echo "Ostatnia komenda: ${BASH_COMMAND:-?}" >&2
  echo "" >&2
  if [[ -f "${PRE_RELEASE_FILE}" ]]; then
    local sha
    sha="$(tr -d ' \n\r' <"${PRE_RELEASE_FILE}")"
    echo "--- Rollback: stan przed tym release (git) ---" >&2
    echo "  cd \"${APP_ROOT}\"" >&2
    echo "  git reset --hard ${sha}" >&2
    echo "  (opcjonalnie) git clean -fd  — tylko jeśli wiesz, co usuniesz" >&2
  fi
  if [[ -f "${RECOVER_DIR}/pre_pull_commit" ]]; then
    echo "--- Ostatni commit sprzed pull w deploy-prod (rollback deployu) ---" >&2
    tr -d ' \n\r' <"${RECOVER_DIR}/pre_pull_commit" >&2 || true
    echo "" >&2
  fi
  if [[ -f "${RECOVER_DIR}/last_success_commit" ]]; then
    echo "Ostatni deploy zapisany jako sukces: $(tr -d ' \n\r' <"${RECOVER_DIR}/last_success_commit")" >&2
  fi
  echo "" >&2
  echo "--- Recovery snapshots (ostatnie .tgz w ${RECOVER_DIR}) ---" >&2
  ls -1t "${RECOVER_DIR}"/source_*.tgz 2>/dev/null | head -8 >&2 || echo "(brak source_*.tgz)" >&2
  echo "" >&2
  echo "════════════════════════════════════════════════════════════" >&2
  echo " EstateOS™ RELEASE FAILED — raport skrócony" >&2
  echo "════════════════════════════════════════════════════════════" >&2
  echo " BUILD_GATE: ${BUILD_GATE_STATUS:-?}" >&2
  echo " DEPLOY:     ${DEPLOY_STATUS:-?}" >&2
  echo " SMOKE:      ${SMOKE_STATUS:-?}" >&2
  echo " HEALTH:     ${LOCAL_HEALTH_STATUS:-?} (HTTP ${LOCAL_HEALTH_CODE:-n/a})" >&2
  echo "════════════════════════════════════════════════════════════" >&2
  echo "" >&2
  echo "Pełniejsza diagnoza: deploy-prod trap / logi PM2 / npm error powyżej." >&2
  exit "${code}"
}

trap 'release_failed' ERR

exec > >(tee "${REPORT_FILE}") 2>&1

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " EstateOS™ RELEASE — $(date -Is)"
echo " APP_ROOT=${APP_ROOT}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if ! command -v git >/dev/null 2>&1; then
  echo "ERROR: git nie jest w PATH" >&2
  exit 127
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERROR: to nie jest repozytorium git" >&2
  exit 128
fi

BUILD_GATE_STATUS="SKIPPED"
DEPLOY_STATUS="NOT_RUN"
SMOKE_STATUS="NOT_RUN"
LOCAL_HEALTH_STATUS="NOT_RUN"
LOCAL_HEALTH_CODE=""
HTTP_ROOT="n/a"
HTTP_HEALTH="n/a"
HTTP_ASSETLINKS="n/a"
HTTP_AASA="n/a"
PM2_SUMMARY="n/a"

echo ""
echo "==> [1/10] git status"
git status -sb

echo ""
echo "==> [2/10] czystość repo + opcjonalny auto-commit"
DIRTY=0
if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
  DIRTY=1
fi

if [[ "${DIRTY}" == "1" ]]; then
  if [[ "${RELEASE_AUTO_COMMIT:-0}" != "1" ]]; then
    echo "ERROR: working tree nie jest czysty." >&2
    echo "  Zrób ręczny commit albo uruchom ponownie z RELEASE_AUTO_COMMIT=1" >&2
    echo "  (auto-commit: git add -A, odczepienie .env jeśli śledzony, commit komunikatem release)." >&2
    exit 2
  fi
  echo "RELEASE_AUTO_COMMIT=1 — tworzę commit…"
  git add -A
  if git ls-files --error-unmatch .env >/dev/null 2>&1; then
    git reset HEAD -- .env 2>/dev/null || true
  fi
  if git diff --cached --quiet; then
    echo "WARN: po git add -A brak zmian do zacommitowania (np. tylko pliki ignorowane)." >&2
  else
    git commit -m "chore(release): auto-commit $(date -u +%Y%m%dT%H%M%SZ)"
  fi
else
  echo "OK: working tree czysty."
fi

echo ""
if [[ "${RELEASE_SKIP_PREBUILD:-0}" == "1" ]]; then
  echo "==> [3/10] type-check + build — POMINIĘTE (RELEASE_SKIP_PREBUILD=1)"
  BUILD_GATE_STATUS="SKIPPED"
else
  echo "==> [3/10] type-check + build (gate przed push / deploy)"
  npm run type-check
  npm run build
  echo "OK: type-check + build zakończone przed push."
  BUILD_GATE_STATUS="OK"
fi

echo ""
echo "==> [4/10] dostęp SSH / GitHub (gdy origin = git@…)"
ORIGIN_URL="$(git remote get-url origin 2>/dev/null || echo "")"
if [[ "${ORIGIN_URL}" =~ ^git@ ]]; then
  echo "origin: ${ORIGIN_URL}"
  set +e
  SSH_OUT="$(ssh -o BatchMode=yes -o ConnectTimeout=12 -T git@github.com 2>&1)"
  SSH_EC=$?
  set -e
  echo "${SSH_OUT}"
  if echo "${SSH_OUT}" | grep -qiE 'Permission denied|publickey|Connection refused|Could not resolve|Operation timed out|No route to host'; then
    echo "ERROR: SSH do GitHuba nie działa (klucz / sieć). Napraw ssh-agent lub known_hosts." >&2
    exit 3
  fi
  if [[ "${SSH_EC}" != "0" ]] && ! echo "${SSH_OUT}" | grep -qiE 'successfully authenticated|Welcome to GitHub'; then
    echo "ERROR: nieoczekiwany wynik SSH (exit ${SSH_EC})." >&2
    exit 3
  fi
  echo "OK: SSH do GitHuba wygląda na dostępny."
else
  echo "origin nie jest git@ (HTTPS/inne): pomijam test ssh -T; push może wymagać credential helpera."
fi

echo ""
echo "==> [5/10] PM2 przed deployem"
if ! command -v pm2 >/dev/null 2>&1; then
  echo "ERROR: brak pm2 w PATH — deploy produkcyjny nie ma sensu." >&2
  exit 4
fi
pm2 list | head -25

echo ""
echo "==> [6/10] git push"
if [[ "${RELEASE_SKIP_PUSH:-0}" == "1" ]]; then
  echo "RELEASE_SKIP_PUSH=1 — pomijam push."
else
  CURRENT_BRANCH="$(git branch --show-current 2>/dev/null || echo "")"
  if [[ -z "${CURRENT_BRANCH}" ]] || [[ "${CURRENT_BRANCH}" == "HEAD" ]]; then
    echo "ERROR: detached HEAD / brak nazwy gałęzi — nie wykonuję push." >&2
    exit 5
  fi
  GIT_TERMINAL_PROMPT=0 git push -u origin "${CURRENT_BRANCH}"
  echo "OK: push zakończony."
fi

echo ""
echo "==> [7/10] npm run deploy:prod (preflight, backup, pull, build, PM2, smoke, health lokalny)"
export APP_ROOT SMOKE_BASE_URL PM2_APP
export DEPLOY_LOCK_TRIGGER="${DEPLOY_LOCK_TRIGGER:-npm-release}"
npm run deploy:prod
DEPLOY_STATUS="OK"

echo ""
echo "==> [8/10] smoke test (powtórka na SMOKE_BASE_URL=${SMOKE_BASE_URL})"
SMOKE_BASE_URL="${SMOKE_BASE_URL}" node "${APP_ROOT}/scripts/postdeploy-smoke.cjs"
SMOKE_STATUS="OK"

echo ""
echo "==> [9/10] healthcheck lokalny (SMOKE_BASE_URL/api/health)"
LOCAL_HEALTH_CODE="$(curl -sS -o /dev/null -w '%{http_code}' "${SMOKE_BASE_URL}/api/health" || echo ERR)"
echo "  lokalny /api/health: HTTP ${LOCAL_HEALTH_CODE}"
if [[ "${LOCAL_HEALTH_CODE}" != "200" ]]; then
  echo "ERROR: oczekiwano 200 dla lokalnego /api/health" >&2
  exit 7
fi
LOCAL_HEALTH_STATUS="OK"

echo ""
echo "==> [10/10] curle publiczne + PM2 + raport końcowy (PROD_URL=${PROD_URL})"
if [[ "${RELEASE_SKIP_PROD_CURL:-0}" == "1" ]]; then
  echo "RELEASE_SKIP_PROD_CURL=1 — pomijam curle na PROD_URL."
  HTTP_ROOT="SKIPPED"
  HTTP_HEALTH="SKIPPED"
  HTTP_ASSETLINKS="SKIPPED"
  HTTP_AASA="SKIPPED"
else
  http_get() {
    curl -sS -o /dev/null -w '%{http_code}' "$1" 2>/dev/null || echo ERR
  }
  HTTP_ROOT="$(http_get "${PROD_URL}/")"
  echo "  PROD /: HTTP ${HTTP_ROOT}"
  HTTP_HEALTH="$(http_get "${PROD_URL}/api/health")"
  echo "  PROD /api/health: HTTP ${HTTP_HEALTH}"
  HTTP_ASSETLINKS="$(http_get "${PROD_URL}/.well-known/assetlinks.json")"
  echo "  PROD /.well-known/assetlinks.json: HTTP ${HTTP_ASSETLINKS}"
  HTTP_AASA="$(http_get "${PROD_URL}/.well-known/apple-app-site-association")"
  echo "  PROD /.well-known/apple-app-site-association: HTTP ${HTTP_AASA}"
  if [[ "${HTTP_ROOT}" != "200" || "${HTTP_HEALTH}" != "200" || "${HTTP_ASSETLINKS}" != "200" || "${HTTP_AASA}" != "200" ]]; then
    echo "ERROR: oczekiwano 200 dla wszystkich curli PROD_URL" >&2
    exit 6
  fi
fi

pm2 describe "${PM2_APP}" 2>&1 | head -45
pm2 logs "${PM2_APP}" --lines 30 --nostream 2>&1 | tail -35 || true
PM2_SUMMARY="$(pm2 show "${PM2_APP}" 2>/dev/null | grep -E 'status|restarts|uptime|memory' | head -8 | tr '\n' ' ' | sed 's/  */ /g' || echo "(brak pm2 show)")"

trap - ERR

HEAD_SHA="$(git rev-parse HEAD)"
PRE_REL="$(tr -d ' \n\r' <"${PRE_RELEASE_FILE}" 2>/dev/null || echo "?")"
LAST_OK=""
if [[ -f "${RECOVER_DIR}/last_success_commit" ]]; then
  LAST_OK="$(tr -d ' \n\r' <"${RECOVER_DIR}/last_success_commit")"
fi

echo ""
echo "════════════════════════════════════════════════════════════"
echo " EstateOS™ RELEASE REPORT — $(date -Is)"
echo "════════════════════════════════════════════════════════════"
echo " SHA_HEAD:                  ${HEAD_SHA}"
echo " SHA_ROLLBACK_PRE_RELEASE:  ${PRE_REL}"
if [[ -n "${LAST_OK}" ]]; then
  echo " last_success_commit:       ${LAST_OK}"
fi
echo " BUILD_GATE (pre-push):     ${BUILD_GATE_STATUS}"
echo " DEPLOY (deploy:prod):      ${DEPLOY_STATUS}"
echo " SMOKE (postdeploy-smoke):  ${SMOKE_STATUS}"
echo " HEALTH local /api/health:  ${LOCAL_HEALTH_STATUS} (HTTP ${LOCAL_HEALTH_CODE})"
echo " HTTP PROD /:              ${HTTP_ROOT}"
echo " HTTP PROD /api/health:    ${HTTP_HEALTH}"
echo " HTTP PROD assetlinks:     ${HTTP_ASSETLINKS}"
echo " HTTP PROD aasa:           ${HTTP_AASA}"
echo " PM2_APP (${PM2_APP}):     ${PM2_SUMMARY}"
echo " Pełny log (tee):           ${REPORT_FILE}"
echo "════════════════════════════════════════════════════════════"
echo ""
echo " RELEASE OK — pełny pipeline zakończony powodzeniem."

#!/usr/bin/env bash
# EstateOS™ — deploy staging (ten sam kod, inny PM2 / port / plik env).
# Wymaga .env.staging oraz ecosystem.staging.config.cjs (domyślne ścieżki pod APP_ROOT).

set -euo pipefail

APP_ROOT="${APP_ROOT:-/home/rommar/estateos}"
export APP_ROOT
export DEPLOY_ENV_FILE="${DEPLOY_ENV_FILE:-${APP_ROOT}/.env.staging}"
export DEPLOY_ECOSYSTEM="${DEPLOY_ECOSYSTEM:-ecosystem.staging.config.cjs}"
export DEPLOY_PM2_ENV="${DEPLOY_PM2_ENV:-staging}"
export PM2_APP="${PM2_APP:-nieruchomosci-staging}"
export SMOKE_BASE_URL="${SMOKE_BASE_URL:-http://127.0.0.1:3001}"
export SKIP_BACKUP="${SKIP_BACKUP:-1}"
# Staging nie zapisuje snapshotów releases/ (unikamy przypadkowego RELEASE_IMMUTABLE z shella operatora).
export RELEASE_IMMUTABLE=0

exec bash "${APP_ROOT}/scripts/deploy-prod.sh"

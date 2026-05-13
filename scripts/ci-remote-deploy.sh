#!/usr/bin/env bash
# Wywoływany z GitHub Actions przez SSH na serwerze.
# Env: ESTATEOS_APP_PATH (wymagane), ESTATEOS_GIT_BRANCH (domyślnie production), ESTATEOS_DEPLOY_CMD (domyślnie npm run deploy:prod)
# Opcjonalnie: DEPLOY_LOCK_TRIGGER (np. github-actions) — przekazywane do deploy-prod (wpis w .deploy/deploy.lock).
set -euo pipefail
ROOT="${ESTATEOS_APP_PATH:?ESTATEOS_APP_PATH required}"
BRANCH="${ESTATEOS_GIT_BRANCH:-production}"
CMD="${ESTATEOS_DEPLOY_CMD:-npm run deploy:prod}"
: "${DEPLOY_LOCK_TRIGGER:=local}"
export DEPLOY_LOCK_TRIGGER
cd "$ROOT"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"
exec env DEPLOY_LOCK_TRIGGER="${DEPLOY_LOCK_TRIGGER}" bash -lc "${CMD}"

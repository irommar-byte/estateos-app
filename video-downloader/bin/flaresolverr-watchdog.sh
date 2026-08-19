#!/usr/bin/env bash
set -euo pipefail

CONTAINER="${FLARESOLVERR_CONTAINER:-flaresolverr}"
API="${FLARESOLVERR_URL:-http://127.0.0.1:8191}/v1"
REQUEST_FILE="${FLARESOLVERR_RESTART_REQUEST:-/tmp/flaresolverr-restart-request}"
STAMP_FILE="${FLARESOLVERR_RESTART_STAMP:-/tmp/flaresolverr-restart-stamp}"
LOCK_FILE="${FLARESOLVERR_RESTART_LOCK:-/tmp/flaresolverr-restart.lock}"
MIN_RESTART_GAP="${FLARESOLVERR_MIN_RESTART_GAP:-20}"

exec 9>"$LOCK_FILE"
flock -n 9 || exit 0

now=$(date +%s)
requested=0
[[ -s "$REQUEST_FILE" ]] && requested=1

healthy=0
if curl -fsS --max-time 8   -X POST -H 'Content-Type: application/json'   -d '{"cmd":"sessions.list"}' "$API" | python3 -c 'import json,sys; raise SystemExit(0 if json.load(sys.stdin).get("status") == "ok" else 1)'; then
  healthy=1
fi

if [[ "$requested" -eq 0 && "$healthy" -eq 1 ]]; then
  exit 0
fi

last=0
[[ -f "$STAMP_FILE" ]] && last=$(cat "$STAMP_FILE" 2>/dev/null || echo 0)
if (( now - last < MIN_RESTART_GAP )); then
  exit 0
fi

reason="health check failed"
if [[ "$requested" -eq 1 ]]; then
  reason=$(tr '
' ' ' < "$REQUEST_FILE" | cut -c1-500)
fi
printf '%s FlareSolverr restart: %s
' "$(date -Is)" "$reason"
docker restart "$CONTAINER"
printf '%s
' "$now" > "$STAMP_FILE"
rm -f "$REQUEST_FILE"
sleep 8
curl -fsS --max-time 8   -X POST -H 'Content-Type: application/json'   -d '{"cmd":"sessions.list"}' "$API" >/dev/null
printf '%s FlareSolverr healthy after restart
' "$(date -Is)"

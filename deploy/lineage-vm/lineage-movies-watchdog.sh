#!/bin/bash
set -uo pipefail
exec 9>/run/lineage-movies-watchdog.lock
flock -n 9 || exit 0

HOST="${LISTEN_HOST:-192.168.50.200}"

http_code() {
  local port="$1"
  curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "http://${HOST}:${port}/" 2>/dev/null || echo 000
}

listening() {
  local port="$1"
  ss -lnt | grep -Eq ":${port}\\b"
}

restart_one() {
  local name="$1"
  echo "$(date -Is) restart $name"
  sudo -u rommar -H bash -lc "pm2 restart $name"
}

code1=$(http_code 4321)
code2=$(http_code 4322)
if [ "$code1" = "000" ] || ! listening 4321; then
  restart_one lineage-movies-downloader
fi
if [ "$code2" = "000" ] || ! listening 4322; then
  restart_one lineage-movies-proxy
fi

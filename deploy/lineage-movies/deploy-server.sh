#!/usr/bin/env bash
# Szybkie wgranie serwera EOS (video-downloader + auth-proxy) na Lineage VM.
# Użycie (z katalogu repo):  deploy/lineage-movies/deploy-server.sh
#   --logs  dodatkowo jednorazowo ustawia przycinanie logów (pm2-logrotate + journald)
set -euo pipefail
REMOTE="${LINEAGE_MOVIES_HOST:-rommar@192.168.50.200}"
REMOTE_DIR="${LINEAGE_MOVIES_DIR:-lineage-movies}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="$ROOT/video-downloader"

echo "→ Sprawdzam składnię lokalnie"
if command -v node >/dev/null; then for f in "$SRC"/*.js "$ROOT/deploy/lineage-movies/auth-proxy.js"; do node --check "$f"; done; fi

echo "→ Wgrywam pliki do $REMOTE:~/$REMOTE_DIR/video-downloader"
rsync -az --checksum --itemize-changes \
  --include '*.js' --include '*.mjs' --include 'package.json' --include 'package-lock.json' \
  --exclude '*' \
  "$SRC/" "$REMOTE:$REMOTE_DIR/video-downloader/" | sed 's/^/   /'
rsync -az --checksum --itemize-changes "$ROOT/deploy/lineage-movies/auth-proxy.js" "$REMOTE:$REMOTE_DIR/" | sed 's/^/   /'

echo "→ Restart i kontrola"
ssh "$REMOTE" bash -s <<REMOTE_SH
set -e
cd ~/$REMOTE_DIR
rm -f server.js apple-music.js   # zabłąkane kopie poza video-downloader
cd video-downloader && node --check server.js
if [ package.json -nt node_modules/.package-lock.json ] 2>/dev/null; then npm install --omit=dev --no-audit --no-fund >/dev/null; fi
pm2 restart lineage-movies-downloader lineage-movies-proxy >/dev/null
H=\$(hostname -I | awk '{print \$1}')
health() { curl -sf -m 3 http://\$H:4321/api/health >/dev/null || curl -sf -m 3 http://127.0.0.1:4321/api/health >/dev/null; }
for i in \$(seq 1 20); do health && break; sleep 1; done
health && echo "   serwer: OK" || { echo "   serwer: NIE ODPOWIADA"; pm2 logs lineage-movies-downloader --lines 20 --nostream; exit 1; }
echo "   yt-dlp: \$(bin/yt-dlp --version 2>/dev/null || echo brak)"
echo "   dysk:   \$(df -h / | awk 'NR==2{print \$5" zajęte, "\$4" wolne"}')"
REMOTE_SH

if [[ "${1:-}" == "--logs" ]]; then
  echo "→ Przycinanie logów"
  ssh "$REMOTE" bash -s <<'REMOTE_SH'
set -e
pm2 describe pm2-logrotate >/dev/null 2>&1 || pm2 install pm2-logrotate >/dev/null
pm2 set pm2-logrotate:max_size 10M >/dev/null
pm2 set pm2-logrotate:retain 5 >/dev/null
pm2 set pm2-logrotate:compress true >/dev/null
pm2 flush >/dev/null
echo "   logi pm2: max 10 MB x 5"
if [ -f /etc/systemd/journald.conf.d/eos-limit.conf ]; then
  echo "   journald: limit 300 MB już ustawiony"
elif sudo -n true 2>/dev/null; then
  sudo -n mkdir -p /etc/systemd/journald.conf.d
  printf '[Journal]\nSystemMaxUse=300M\n' | sudo -n tee /etc/systemd/journald.conf.d/eos-limit.conf >/dev/null
  sudo -n systemctl restart systemd-journald
  echo "   journald: max 300 MB"
else
  echo "   journald: pominięty (sudo wymaga hasła) — ustaw raz z konsoli root"
fi
REMOTE_SH
fi
echo "✓ Gotowe"

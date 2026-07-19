#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PKG="$ROOT/deploy/lineage-movies"
REMOTE="estateos"
REMOTE_DIR="/home/rommar/lineage-movies"
NGINX_SITE="/etc/nginx/sites-available/lineage"
MARKER="# LINEAGE-MOVIES-AUTO"

# Unikalny build przy każdym deployu — wymusza odświeżenie inject.js i iframe w Safari
BUILD_ID="$(date -u +%Y%m%d%H%M%S)"
echo "→ Build ID: $BUILD_ID"

echo "→ Sync UI video-downloader → public/"
bash "$PKG/sync-public.sh"

echo "→ Wersja w inject.js + build.json + nginx inc"
node - "$PKG/inject.js" "$PKG/public/build.json" "$PKG/nginx-lineage-movies.inc" "$BUILD_ID" <<'NODE'
const fs = require("fs");
const [injectPath, buildPath, nginxIncPath, buildId] = process.argv.slice(2);
let js = fs.readFileSync(injectPath, "utf8");
js = js.replace(/const INJECT_BUILD = "[^"]*"/, `const INJECT_BUILD = "${buildId}"`);
js = js.replace(/const UI_VERSION = "[^"]*"/, `const UI_VERSION = "${buildId}"`);
fs.writeFileSync(injectPath, js);
fs.writeFileSync(
  buildPath,
  JSON.stringify({ ui: buildId, inject: buildId, built: new Date().toISOString() }, null, 2) + "\n"
);
let inc = fs.readFileSync(nginxIncPath, "utf8");
inc = inc.replace(/__INJECT_BUILD__/g, buildId);
fs.writeFileSync(nginxIncPath + ".deploy", inc);
console.log("  inject UI_VERSION =", buildId);
NODE

echo "→ Sync pakietu na $REMOTE:$REMOTE_DIR"
ssh "$REMOTE" "mkdir -p $REMOTE_DIR/public $REMOTE_DIR/video-downloader"

rsync -az \
  "$PKG/auth-proxy.js" \
  "$PKG/inject.js" \
  "$PKG/ecosystem.config.cjs" \
  "$REMOTE:$REMOTE_DIR/"

rsync -az \
  "$PKG/nginx-lineage-movies.inc.deploy" \
  "$REMOTE:$REMOTE_DIR/nginx-lineage-movies.inc"

rsync -az --delete \
  "$PKG/public/" \
  "$REMOTE:$REMOTE_DIR/public/"

rsync -az \
  --exclude node_modules \
  --exclude downloads \
  --exclude tmp \
  --exclude data/cda-hd-session.json \
  --exclude data/cda-hd-catalog-cache.json \
  --exclude data/movies-favorites \
  --exclude data/movies-library \
  --exclude data/music-library \
  --exclude data/portal-sessions \
  "$ROOT/video-downloader/" \
  "$REMOTE:$REMOTE_DIR/video-downloader/"

echo "→ npm install"
ssh "$REMOTE" bash -s <<'REMOTE'
set -euo pipefail
cd ~/lineage-movies/video-downloader
npm install --omit=dev
if [ ! -x bin/yt-dlp ]; then
  mkdir -p bin
  curl -sL "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp" -o bin/yt-dlp
  chmod +x bin/yt-dlp
fi
cd ~/lineage-movies
if [ ! -f package.json ]; then npm init -y >/dev/null; fi
node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('package.json','utf8')); p.type='module'; fs.writeFileSync('package.json', JSON.stringify(p,null,2));"
npm install express@4 --omit=dev
REMOTE

echo "→ nginx (inject.js?v=$BUILD_ID, no-store)"
ssh "$REMOTE" bash -s <<REMOTE
set -euo pipefail
NGINX_SITE="$NGINX_SITE"
MARKER="$MARKER"
INC="$REMOTE_DIR/nginx-lineage-movies.inc"
BUILD_ID="$BUILD_ID"

patch_nginx() {
  python3 - "\$NGINX_SITE" "\$INC" "\$MARKER" "\$HOME/lineage-nginx.tmp" <<'PY'
import sys, re
site, inc_path, marker, tmp = sys.argv[1:5]
text = open(site).read()
inc = open(inc_path).read().rstrip() + "\n\n"

if marker not in text:
    lines = text.splitlines(True)
    out = []
    inserted = False
    for line in lines:
        if not inserted and line.strip().startswith("location /"):
            out.append(f"    {marker}\n")
            out.append(inc)
            inserted = True
        if "sub_filter" in line:
            continue
        if line.strip() in ("sub_filter_once on;", "sub_filter_types text/html;"):
            continue
        if "X-Forwarded-Proto" in line and "Accept-Encoding" not in "".join(out[-8:]):
            out.append(line)
            out.append('        proxy_set_header Accept-Encoding "";\n')
            continue
        out.append(line)
    open(tmp, "w").write("".join(out))
else:
    pat = re.compile(
        r"(\s+" + re.escape(marker) + r"\n)" + r".*?" + r"(\n\s+location /)",
        re.DOTALL,
    )
    m = pat.search(text)
    if not m:
        sys.exit("Nie znaleziono bloku LINEAGE-MOVIES w nginx")
    text = text[: m.start()] + m.group(1) + inc + m.group(2) + text[m.end() :]
    open(tmp, "w").write(text)
    print("  nginx LINEAGE-MOVIES block refreshed")
PY
  sudo cp "\$NGINX_SITE" "\${NGINX_SITE}.bak-\$(date +%Y%m%d%H%M%S)" 2>/dev/null || true
  sudo mv "\$HOME/lineage-nginx.tmp" "\$NGINX_SITE"
}

patch_nginx
sudo nginx -t
sudo systemctl reload nginx
REMOTE

echo "→ FlareSolverr (Cloudflare bypass dla CDA-HD)"
ssh "$REMOTE" bash -s <<'REMOTE'
set -euo pipefail
ensure_fs() {
  if ! sudo docker ps -a --format '{{.Names}}' | grep -qx flaresolverr; then
    sudo docker pull ghcr.io/flaresolverr/flaresolverr:latest
    sudo docker run -d --name flaresolverr --restart unless-stopped       -p 127.0.0.1:8191:8191 -e LOG_LEVEL=info       ghcr.io/flaresolverr/flaresolverr:latest
  else
    sudo docker start flaresolverr >/dev/null || true
  fi
  for i in 1 2 3 4 5 6 7 8 9 10; do
    if curl -fsS http://127.0.0.1:8191/ >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}
ensure_fs || echo "  WARN: FlareSolverr nie odpowiada na :8191" >&2
# Self-heal: jeśli Chromium utknie na new-tab/spam, odtwórz kontener.
PROBE=$(curl -sS -X POST http://127.0.0.1:8191/v1   -H "Content-Type: application/json"   -d "{"cmd":"request.get","url":"https://cda-hd.cc/","maxTimeout":60000}"   --max-time 75 2>/dev/null || true)
if ! printf '%s' "$PROBE" | grep -q 'CDA-HD'; then
  echo "  FlareSolverr zwrócił śmieci — recreate"
  sudo docker rm -f flaresolverr >/dev/null || true
  ensure_fs || true
fi
echo "  FlareSolverr ready"
REMOTE

echo "→ PM2"
ssh "$REMOTE" "cd $REMOTE_DIR && pm2 delete lineage-movies-downloader lineage-movies-proxy 2>/dev/null || true; pm2 start ecosystem.config.cjs && pm2 save"

echo "→ Weryfikacja na żywo (build $BUILD_ID)"
FAIL=0
sleep 2

check() {
  local label="$1"
  local pattern="$2"
  local url="$3"
  local body=""
  local attempt
  for attempt in 1 2 3 4 5; do
    body=$(curl -fsS "$url" 2>/dev/null) && break
    sleep 1
  done
  if [ -n "$body" ] && printf '%s' "$body" | grep -qF "$pattern"; then
    echo "  OK $label"
  else
    echo "  FAIL $label (missing: $pattern)"
    FAIL=1
  fi
}

check "inject.js INJECT_BUILD" "INJECT_BUILD = \"$BUILD_ID\"" "https://lineage.mycloudnas.com/admin_pro/movies/inject.js"
check "panel inject" "inject.js?v=$BUILD_ID" "https://lineage.mycloudnas.com/panel.php"
ADMIN_BODY=$(curl -fsS "https://lineage.mycloudnas.com/admin_pro/" 2>/dev/null || true)
if printf '%s' "$ADMIN_BODY" | grep -qF "inject.js?v=$BUILD_ID"; then
  echo "  FAIL admin still has inject.js (should be user panel only)"
  FAIL=1
else
  echo "  OK admin bez inject.js"
fi
check "UI previewBtn" "previewBtn" "https://lineage.mycloudnas.com/admin_pro/movies/?ui=$BUILD_ID"
check "build.json" "\"ui\": \"$BUILD_ID\"" "https://lineage.mycloudnas.com/admin_pro/movies/build.json"

INJECT_CACHE=$(curl -sI "https://lineage.mycloudnas.com/admin_pro/movies/inject.js" | tr -d '\r' | grep -i '^cache-control:' || true)
if echo "$INJECT_CACHE" | grep -qiE 'no-store|no-cache|max-age=0'; then
  echo "  OK inject.js Cache-Control: $INJECT_CACHE"
else
  echo "  FAIL inject.js still cached: $INJECT_CACHE"
  FAIL=1
fi

ssh "$REMOTE" "for i in 1 2 3 4 5; do curl -sf http://127.0.0.1:4321/api/health >/dev/null && exit 0; sleep 1; done; exit 1" \
  && echo "  OK downloader health" || { echo "  FAIL downloader health"; FAIL=1; }

echo "→ Smoke download/play/search"
rsync -az "$PKG/smoke-movies.mjs" "$REMOTE:$REMOTE_DIR/smoke-movies.mjs"
SMOKE_SECRET=$(ssh "$REMOTE" "cd $REMOTE_DIR && node -e \"const c=require('./ecosystem.config.cjs'); console.log(c.apps.find(a=>a.name==='lineage-movies-downloader').env.MOVIES_JWT_SECRET)\"" 2>/dev/null || true)
if [ -n "$SMOKE_SECRET" ]; then
  if ssh "$REMOTE" "cd $REMOTE_DIR && MOVIES_JWT_SECRET='$SMOKE_SECRET' MOVIES_ROOT=$REMOTE_DIR/video-downloader MUSIC_PLAYLIST_DOWNLOADS_DIR=$REMOTE_DIR/downloads node smoke-movies.mjs"; then
    echo "  OK smoke-movies"
  else
    echo "  FAIL smoke-movies"
    FAIL=1
  fi
else
  echo "  SKIP smoke-movies (brak JWT secret)"
fi

# CDA-HD: pierwszy request może iść przez FlareSolverr (~30–90s)
CDA_OK=0
for attempt in 1 2 3 4 5 6 7 8; do
  CDA_BODY=$(ssh "$REMOTE" "curl -fsS --max-time 120 'http://127.0.0.1:4321/api/cda-hd/latest?limit=5'" 2>/dev/null || true)
  if printf '%s' "$CDA_BODY" | grep -qE '"items":\[\{|"url":"https://cda-hd'; then
    echo "  OK cda-hd/latest (items)"
    CDA_OK=1
    break
  fi
  echo "  … cda-hd/latest attempt $attempt"
  sleep 8
done
if [ "$CDA_OK" -ne 1 ]; then
  echo "  FAIL cda-hd/latest (brak items)"
  echo "  $(ssh "$REMOTE" "curl -fsS --max-time 20 'http://127.0.0.1:4321/api/cda-hd/health' 2>/dev/null || true")"
  FAIL=1
fi

if [ "$FAIL" -ne 0 ]; then
  echo ""
  echo "Deploy finished with verification errors."
  exit 1
fi

echo ""
echo "Deploy OK - build $BUILD_ID"
echo "  https://lineage.mycloudnas.com/panel.php → NOSTALGIE™ MOVIES (po zalogowaniu)"
echo "  Ulubione zapisane na koncie użytkownika."

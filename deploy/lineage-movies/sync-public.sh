#!/usr/bin/env bash
# Kopiuje UI z video-downloader/public → deploy/lineage-movies/public (z prefiksem API admina).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC_DIR="$ROOT/video-downloader/public"
DST_DIR="$ROOT/deploy/lineage-movies/public"
node - "$SRC_DIR/index.html" "$DST_DIR/index.html" <<'NODE'
const fs = require("fs");
const path = require("path");
const [src, dst] = process.argv.slice(2);
let html = fs.readFileSync(src, "utf8");
const needle = 'const __API_PFX = __apiQs.get("apiPrefix") || "";';
const patch =
  'const __defaultPfx = location.pathname.includes("/admin_pro/movies") ? "/admin_pro/api/movies/proxy" : "";\n' +
  '      const __API_PFX = __apiQs.get("apiPrefix") || __defaultPfx;';
if (!html.includes("__defaultPfx")) {
  if (!html.includes(needle)) {
    console.error("sync-public: nie znaleziono __API_PFX w źródle");
    process.exit(1);
  }
  html = html.replace(needle, patch);
}
fs.mkdirSync(path.dirname(dst), { recursive: true });
fs.writeFileSync(dst, html);
console.log("sync-public: OK →", dst);
NODE

for f in music-ui.css music-ui.js; do
  cp "$SRC_DIR/$f" "$DST_DIR/$f"
  echo "sync-public: OK → $DST_DIR/$f"
done

#!/usr/bin/env bash
# Kopiuje UI z video-downloader/public → deploy/lineage-movies/public (z prefiksem API admina).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="$ROOT/video-downloader/public/index.html"
DST="$ROOT/deploy/lineage-movies/public/index.html"
node - "$SRC" "$DST" <<'NODE'
const fs = require("fs");
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
fs.mkdirSync(require("path").dirname(dst), { recursive: true });
fs.writeFileSync(dst, html);
console.log("sync-public: OK →", dst);
NODE

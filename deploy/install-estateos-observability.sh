#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
STAMP="$(date +%Y%m%d%H%M%S)"
SITE="/etc/nginx/sites-available/nieruchomosci"
ENABLED_SITE="/etc/nginx/sites-enabled/nieruchomosci"

sudo cp "$SITE" "${SITE}.bak-${STAMP}"
if [ -e "$ENABLED_SITE" ] && [ ! "$SITE" -ef "$ENABLED_SITE" ]; then
  sudo cp "$ENABLED_SITE" "${SITE}.enabled.bak-${STAMP}"
fi
sudo install -m 0644 "$ROOT/deploy/nginx-estateos-tuning.conf" /etc/nginx/conf.d/estateos-tuning.conf
if [ -f "$ROOT/deploy/nginx-lineage-upstreams.conf" ]; then
  sudo install -m 0644 "$ROOT/deploy/nginx-lineage-upstreams.conf" /etc/nginx/conf.d/lineage-upstreams.conf
fi
LINEAGE_SITE="/etc/nginx/sites-enabled/lineage"
if [ -f "$ROOT/deploy/nginx-lineage-site.conf" ] && [ -f "$LINEAGE_SITE" ]; then
  sudo cp "$LINEAGE_SITE" "${LINEAGE_SITE}.bak-${STAMP}"
  sudo install -m 0644 "$ROOT/deploy/nginx-lineage-site.conf" "$LINEAGE_SITE"
fi
sudo install -m 0644 "$ROOT/deploy/logrotate-estateos" /etc/logrotate.d/estateos
sudo install -m 0644 "$ROOT/deploy/journald-estateos.conf" /etc/systemd/journald.conf.d/estateos-retention.conf
sudo install -m 0644 "$ROOT/deploy/mariadb-estateos-observability.cnf" /etc/mysql/mariadb.conf.d/70-estateos-observability.cnf

python3 - "$SITE" "$ROOT/deploy/nginx-estateos-proxy-location.inc" "/tmp/nieruchomosci.${STAMP}" <<'PY'
import pathlib
import re
import sys

site_path, location_path, temporary_path = map(pathlib.Path, sys.argv[1:4])
site = site_path.read_text()
location = location_path.read_text().strip()
if "estateos-access.log estateos_timed" in site:
    patched = site
else:
    pattern = re.compile(r"(?ms)^    location / \{\n.*?^    \}\n")
    matches = list(pattern.finditer(site))
    if len(matches) != 1:
        raise SystemExit(f"Oczekiwano jednego bloku location /, znaleziono {len(matches)}")
    patched = site[:matches[0].start()] + "\n".join(f"    {line}" for line in location.splitlines()) + "\n" + site[matches[0].end():]
temporary_path.write_text(patched)
PY

sudo install -m 0644 "/tmp/nieruchomosci.${STAMP}" "$SITE"
if [ -e "$ENABLED_SITE" ] && [ ! "$SITE" -ef "$ENABLED_SITE" ]; then
  sudo install -m 0644 "/tmp/nieruchomosci.${STAMP}" "$ENABLED_SITE"
fi
rm -f "/tmp/nieruchomosci.${STAMP}"
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl restart systemd-journald
sudo logrotate --debug /etc/logrotate.d/estateos >/dev/null

echo "Konfiguracja Nginx/logrotate/journald gotowa."
echo "Performance Schema zacznie działać po kontrolowanym restarcie MariaDB."

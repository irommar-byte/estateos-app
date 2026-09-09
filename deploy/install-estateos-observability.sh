#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
STAMP="$(date +%Y%m%d%H%M%S)"
SITE="/etc/nginx/sites-available/nieruchomosci"

sudo cp "$SITE" "${SITE}.bak-${STAMP}"
sudo install -m 0644 "$ROOT/deploy/nginx-estateos-tuning.conf" /etc/nginx/conf.d/estateos-tuning.conf
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
pattern = re.compile(r"(?ms)^    location / \{\n.*?^    \}\n")
matches = list(pattern.finditer(site))
if len(matches) != 1:
    raise SystemExit(f"Oczekiwano jednego bloku location /, znaleziono {len(matches)}")
patched = site[:matches[0].start()] + "\n".join(f"    {line}" for line in location.splitlines()) + "\n" + site[matches[0].end():]
temporary_path.write_text(patched)
PY

sudo install -m 0644 "/tmp/nieruchomosci.${STAMP}" "$SITE"
rm -f "/tmp/nieruchomosci.${STAMP}"
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl restart systemd-journald
sudo logrotate --debug /etc/logrotate.d/estateos >/dev/null

echo "Konfiguracja Nginx/logrotate/journald gotowa."
echo "Performance Schema zacznie działać po kontrolowanym restarcie MariaDB."

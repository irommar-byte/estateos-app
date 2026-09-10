#!/bin/bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"

GAME_LOOP=/srv/l2/RUN/HIGHFIVE/dist/game/GameServer_loop.sh
if [ -f "$GAME_LOOP" ]; then
  cp -a "$GAME_LOOP" "${GAME_LOOP}.bak-20260910"
  python3 "$HERE/patch_gameserver_heap.py"
fi

PREFORK=/etc/apache2/mods-enabled/mpm_prefork.conf
if [ -f "$PREFORK" ]; then
  cp -a "$PREFORK" "${PREFORK}.bak-20260910"
  install -m 0644 "$HERE/mpm_prefork.conf" "$PREFORK"
  apache2ctl configtest
  systemctl reload apache2
fi

if [ -f /root/backup_to_qnap.sh ]; then
  python3 "$HERE/extract_backup_env.py"
  install -m 0700 "$HERE/l2-backup-to-qnap.sh" /usr/local/bin/l2-backup-to-qnap.sh
  install -m 0644 "$HERE/systemd/l2-backup-to-qnap.service" /etc/systemd/system/l2-backup-to-qnap.service
  install -m 0644 "$HERE/systemd/l2-backup-to-qnap.timer" /etc/systemd/system/l2-backup-to-qnap.timer
fi

install -m 0755 "$HERE/lineage-movies-watchdog.sh" /usr/local/bin/lineage-movies-watchdog.sh
install -m 0644 "$HERE/systemd/lineage-movies-watchdog.service" /etc/systemd/system/lineage-movies-watchdog.service
install -m 0644 "$HERE/systemd/lineage-movies-watchdog.timer" /etc/systemd/system/lineage-movies-watchdog.timer

if crontab -l 2>/dev/null | grep -q "telemetry_collector.php"; then
  crontab -l | sed "s#^\* \* \* \* \* php /var/www/html/l2/public/admin_pro/api/telemetry_collector.php#*/5 * * * * php /var/www/html/l2/public/admin_pro/api/telemetry_collector.php#" | crontab -
fi

systemctl daemon-reload
systemctl enable --now lineage-movies-watchdog.timer
if [ -f /etc/systemd/system/l2-backup-to-qnap.timer ]; then
  systemctl enable --now l2-backup-to-qnap.timer
fi
sudo -u rommar -H bash -lc 'pm2 save' >/dev/null || true
echo "Lineage VM tuning installed. GameServer heap applies on next game restart."

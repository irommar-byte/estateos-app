#!/bin/bash
set -euo pipefail
exec 9>/run/l2-backup-to-qnap.lock
flock -n 9 || exit 0

load=$(awk '{printf "%d", $1}' /proc/loadavg)
if [ "$load" -ge 4 ]; then
  echo "$(date -Is) skip backup: load $load"
  exit 0
fi

# shellcheck disable=SC1091
source /root/.backup-qnap.env
: "${MYSQL_USER:?}" "${MYSQL_PASS:?}" "${MYSQL_DB:?}"
: "${QNAP_USER:?}" "${QNAP_PASS:?}" "${QNAP_HOST:?}" "${QNAP_TARGET:?}"

DATE=$(date +%F_%H-%M)
FILE_NAME="Lineage2_Nostalgie_FULL_$DATE.tar.gz"
WORKDIR=$(mktemp -d /tmp/l2-backup.XXXXXX)
trap 'rm -rf "$WORKDIR"' EXIT

echo "$(date -Is) backup start"
nice -n 19 ionice -c3 mysqldump --single-transaction -u "$MYSQL_USER" -p"$MYSQL_PASS" "$MYSQL_DB" > "$WORKDIR/L2_DATABASE_RECOVERY.sql"

nice -n 19 ionice -c3 tar -czf "$WORKDIR/$FILE_NAME" \
  --exclude='*.log' \
  --exclude='log' \
  --exclude='logs' \
  --exclude='*.tmp' \
  --exclude='stdout.log' \
  --exclude='cache' \
  /var/www/html/l2 \
  /srv/l2/RUN/HIGHFIVE \
  "$WORKDIR/L2_DATABASE_RECOVERY.sql" \
  /etc/apache2/sites-available/000-default.conf

nice -n 19 ionice -c3 sshpass -p "$QNAP_PASS" scp -o StrictHostKeyChecking=accept-new \
  "$WORKDIR/$FILE_NAME" "$QNAP_USER@$QNAP_HOST:$QNAP_TARGET"

echo "$(date -Is) backup done $FILE_NAME"

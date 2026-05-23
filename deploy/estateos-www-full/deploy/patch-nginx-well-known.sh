#!/usr/bin/env bash
# Na serwerze: cd ~/estateos && sudo bash deploy/patch-nginx-well-known.sh
#
# 1) Usuwa z /etc/nginx bloki location = /.well-known/... z alias (stary AASA).
# 2) Dodaje jedną linię include do pliku vhosta estateos (jeśli jeszcze nie ma).
#
# Po uruchomieniu: nginx -t && systemctl reload nginx

set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Uruchom: sudo bash $0"
  exit 1
fi

REPO="${REPO:-/home/rommar/estateos}"
INC="$REPO/deploy/nginx-well-known-proxy.inc"
INCLUDE_LINE="    include $INC;"

if [[ ! -f "$INC" ]]; then
  echo "Brak pliku: $INC"
  exit 1
fi

mapfile -t FILES < <(grep -rl 'apple-app-site-association' /etc/nginx 2>/dev/null || true)
if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "Brak dopasowania w /etc/nginx"
  exit 1
fi

for f in "${FILES[@]}"; do
  ts=$(date +%Y%m%d%H%M%S)
  cp -a "$f" "${f}.bak-estateos-${ts}"
  echo "Backup: ${f}.bak-estateos-${ts}"

  # Usuń pojedyncze location = /.well-known/... { ... } (jeden poziom nawiasów).
  perl -i -0777 -pe '
    s/\n[ \t]*location[ \t]*=[ \t]*\/\.well-known\/apple-app-site-association[ \t]*\{[^}]*\}//sg;
    s/\n[ \t]*location[ \t]*=[ \t]*\/\.well-known\/assetlinks\.json[ \t]*\{[^}]*\}//sg;
  ' "$f"

  if grep -qF "$INC" "$f" 2>/dev/null || grep -q 'nginx-well-known-proxy.inc' "$f" 2>/dev/null; then
    echo "Include już jest w $f"
  else
    # Pierwszy blok server { ... } w pliku: wstaw include zaraz po otwarciu.
    perl -i -0777 -pe '
      my $line = qq(\n'"$INCLUDE_LINE"'\n);
      s/(server\s*\{)/$1$line/s or die "Brak server { w pliku — dopisz ręcznie include do vhosta estateos.\n";
    ' "$f"
    echo "Dodano include do: $f"
  fi
done

nginx -t
systemctl reload nginx
echo "Gotowe. Test: curl -sS https://estateos.pl/.well-known/apple-app-site-association | head -c 600"

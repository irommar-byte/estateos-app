# Cutover NAT i VM edge — dokładne kliknięcia

SSH do QNAP (`192.168.50.1:22`) i do Lineage (`192.168.50.200`) z Maca/jump hosta
EstateOS jest obecnie zamknięty. Poniższe kroki zostają otwarte, dopóki nie ma
dostępu do hypervisor/routera. Nie oznaczaj punktu 6 planu jako skończonego
bez smoke z internetu.

## 1. Virtualization Station na QNAP

1. QTS → **Virtualization Station**.
2. Create VM: Debian 12, **1 vCPU**, **768 MB RAM**, dysk 8 GB, mostek LAN.
3. Stały IP LAN, np. `192.168.50.10` (nie 128, nie 200).
4. W Virtualization Station ustaw RAM:
   - EstateOS (128): **4,5 GB**
   - Lineage (200): **4,5 GB**
   - Edge: **768 MB**
   - QTS: zostaw ~**2,25 GB**
5. Nie pinuj wszystkich rdzeni do jednej VM.

## 2. Debian na edge

```bash
apt-get update && apt-get install -y nginx certbot python3-certbot-nginx
mkdir -p /var/www/letsencrypt
# skopiuj deploy/edge/estateos-edge-nginx.conf → /etc/nginx/sites-available/estateos-edge
ln -s /etc/nginx/sites-available/estateos-edge /etc/nginx/sites-enabled/estateos-edge
nginx -t && systemctl reload nginx
certbot certonly --webroot -w /var/www/letsencrypt \
  -d estateos.pl -d www.estateos.pl -d lineage.mycloudnas.com
```

Smoke z edge (zanim ruszysz NAT):

```bash
curl -sS -o /dev/null -w '%{http_code}\n' http://192.168.50.128:80/
curl -sS -o /dev/null -w '%{http_code}\n' http://192.168.50.200:80/
curl -sS -o /dev/null -w '%{http_code}\n' http://192.168.50.200:4321/
curl -sS -o /dev/null -w '%{http_code}\n' http://192.168.50.200:4322/
```

## 3. Router — publiczne 80/443 tylko na IP edge

1. Zapisz obecny NAT 80/443 → `192.168.50.128` jako rollback.
2. Zmień DNAT WAN TCP 80 i 443 na IP VM edge.
3. Nie ruszaj 22/SSH EstateOS.

Po NAT: smoke `https://estateos.pl` i domeny Lineage z sieci poza LAN.

## 4. Firewall po oknie obserwacji

Na `192.168.50.128` (skrypt `deploy/ufw-estateos.sh`):

```bash
sudo apt-get install -y ufw
EDGE_IP=<ip-edge> ENABLE_UFW=1 bash deploy/ufw-estateos.sh
# potem: ufw delete allow 80/443 z WAN; allow 80/443 tylko z EDGE_IP i 192.168.50.0/24
```

Na `.200` analogicznie: 80/443/4321/4322/7777/2106 tylko z edge + LAN admin.
Zamknąć 3000/8191 od WAN.

## 5. SSH Lineage `.200`

Po odblokowaniu klucza:

```bash
ssh rommar@192.168.50.200 'ss -lnt; docker ps; curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8191/'
```

FlareSolverr musi słuchać na `.200` (8191). Dopiero potem kasacja `~/lineage-movies` na 128.

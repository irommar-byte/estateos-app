#!/usr/bin/env bash
# Host firewall for EstateOS app VM (192.168.50.128).
# Public 80/443 stay open until edge NAT cutover. App ports stay LAN-only.
set -euo pipefail
EDGE_IP="${EDGE_IP:-192.168.50.1}"
ADMIN_NET="${ADMIN_NET:-192.168.50.0/24}"

sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment 'ssh'
sudo ufw allow 80/tcp comment 'http-until-edge'
sudo ufw allow 443/tcp comment 'https-until-edge'
sudo ufw deny 3000/tcp comment 'next-loopback-only'
sudo ufw deny 3306/tcp comment 'mariadb-loopback-only'
sudo ufw deny 4321/tcp comment 'movies-ui'
sudo ufw deny 4322/tcp comment 'movies-api'
sudo ufw deny 8191/tcp comment 'flaresolverr'
if [ "${ENABLE_UFW:-0}" = "1" ]; then
  sudo ufw --force enable
fi
sudo ufw status numbered

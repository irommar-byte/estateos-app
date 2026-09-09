#!/usr/bin/env bash
set -euo pipefail
cd /home/rommar/estateos
exec npm run deploy:server-only

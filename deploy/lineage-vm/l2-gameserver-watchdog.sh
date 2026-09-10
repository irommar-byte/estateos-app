#!/bin/bash
# Bring Login/Game back after a QNAP suspend without killing a live Java process.
set -uo pipefail
exec 9>/run/l2-gameserver-watchdog.lock
flock -n 9 || exit 0

LOGIN_DIR=/srv/l2/RUN/HIGHFIVE/dist/login
GAME_DIR=/srv/l2/RUN/HIGHFIVE/dist/game

listening() {
  ss -lnt | grep -Eq ":${1}\\b"
}

has_screen() {
  screen -ls 2>/dev/null | grep -q "$1"
}

if ! pgrep -f 'LoginServer.jar' >/dev/null; then
  if ! has_screen l2_login; then
    echo "$(date -Is) start LoginServer"
    cd "$LOGIN_DIR" && screen -AmdS l2_login ./LoginServer_loop.sh
  fi
fi

if ! pgrep -f 'GameServer.jar' >/dev/null; then
  if ! has_screen l2_game; then
    echo "$(date -Is) start GameServer"
    cd "$GAME_DIR" && screen -AmdS l2_game ./GameServer_loop.sh
  fi
fi

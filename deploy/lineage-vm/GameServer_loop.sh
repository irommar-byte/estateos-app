#!/bin/bash
# Safe heap for the ~4 GB Lineage VM. Never restore -Xmx6144m on this host.
cd "$(dirname "$0")" || exit 1
sleep 2
JAR=$(ls *.jar 2>/dev/null | head -n 1)
if [ -z "$JAR" ]; then
  echo "No GameServer jar in $(pwd)" >&2
  exit 1
fi
while :; do
    echo "$(date -Is) Starting GameServer $JAR" >> stdout.log
    /usr/bin/java -server \
      -Dfile.encoding=UTF-8 \
      -Djava.util.logging.manager=org.l2jmobius.log.ServerLogManager \
      -Dorg.slf4j.simpleLogger.log.com.zaxxer.hikari=warn \
      -XX:+UseZGC \
      -Xms512m -Xmx2g \
      -jar "$JAR" >> stdout.log 2>&1
    echo "$(date -Is) GameServer exited. Restarting in 10s..." >> stdout.log
    sleep 10
done

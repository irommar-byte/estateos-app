#!/usr/bin/env python3
from pathlib import Path
import re
p = Path("/srv/l2/RUN/HIGHFIVE/dist/game/GameServer_loop.sh")
text = p.read_text()
new, n = re.subn(r"-Xms\S+\s+-Xmx\S+", "-Xms512m -Xmx2g", text)
if n == 0:
    new, n = re.subn(r"-Xmx\S+", "-Xmx2g", text)
if "UseZGC" not in new:
    new = new.replace("-server", "-server -XX:+UseZGC", 1)
p.write_text(new)
print("gameserver_loop_heap_patched", n)

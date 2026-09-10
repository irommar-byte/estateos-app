#!/usr/bin/env python3
from pathlib import Path
import re
src = Path("/root/backup_to_qnap.sh")
if not src.exists():
    raise SystemExit("brak /root/backup_to_qnap.sh")
text = src.read_text()
vals = {}
for key in ("QNAP_USER", "QNAP_PASS", "QNAP_HOST", "QNAP_TARGET"):
    m = re.search(rf'^{key}="([^"]*)"', text, re.M)
    if m:
        vals[key] = m.group(1)
m = re.search(r"mysqldump -u (\S+) -p(\S+) (\S+)", text)
if m:
    vals["MYSQL_USER"], vals["MYSQL_PASS"], vals["MYSQL_DB"] = m.group(1), m.group(2), m.group(3)
need = ("QNAP_USER", "QNAP_PASS", "QNAP_HOST", "QNAP_TARGET", "MYSQL_USER", "MYSQL_PASS", "MYSQL_DB")
missing = [k for k in need if k not in vals]
if missing:
    raise SystemExit("brak pol w backup_to_qnap.sh: " + ",".join(missing))
env = Path("/root/.backup-qnap.env")
env.write_text("".join(f'{k}="{v}"\n' for k, v in vals.items()))
env.chmod(0o600)
print("backup-env-ready", ",".join(sorted(vals)))

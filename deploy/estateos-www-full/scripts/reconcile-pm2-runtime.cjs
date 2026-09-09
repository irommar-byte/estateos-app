const { spawnSync } = require("node:child_process");

const LEGACY_PROCESSES = ["kei-auto-import"];

for (const name of LEGACY_PROCESSES) {
  const result = spawnSync("pm2", ["delete", name], {
    encoding: "utf8",
    stdio: "pipe",
  });
  if (result.status === 0) {
    console.log(`[pm2-reconcile] usunięto stary proces ${name}`);
    continue;
  }
  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  if (!/not found|not exist/i.test(output)) {
    console.warn(`[pm2-reconcile] nie udało się usunąć ${name}: ${output.trim()}`);
  }
}

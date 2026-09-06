#!/usr/bin/env node
/**
 * Ustawia COMMIT_SHA w .env na aktualny git (bez commita .env).
 * Health i PM2 pokazują ten sam commit co `git rev-parse`.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env");

function gitShortSha() {
  return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
}

function upsertEnv(filePath, key, value) {
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  let next;
  if (re.test(current)) {
    next = current.replace(re, line);
  } else {
    next = `${current}${current && !current.endsWith("\n") ? "\n" : ""}${line}\n`;
  }
  if (next === current) return false;
  fs.writeFileSync(filePath, next, { encoding: "utf8", mode: 0o600 });
  return true;
}

function main() {
  const sha = gitShortSha();
  if (!/^[0-9a-f]{7,40}$/i.test(sha)) {
    throw new Error(`Niepoprawny git SHA: ${sha}`);
  }
  const changed = upsertEnv(envPath, "COMMIT_SHA", sha);
  console.log(JSON.stringify({ ok: true, commit: sha, envUpdated: changed }));
}

main();

#!/usr/bin/env node
/**
 * `next build` czyści `.next` na starcie i zwala działające workery PM2.
 * Budujemy do `.next-build`, potem atomically podmieniamy katalog.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "..");
const live = path.join(root, ".next");
const staging = path.join(root, ".next-build");
const previous = path.join(root, ".next-prev");
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");

function fail(message, extra) {
  console.error(JSON.stringify({ ok: false, step: "atomic-build", message, ...extra }));
  process.exit(1);
}

function restorePrevious() {
  if (!fs.existsSync(previous) || fs.existsSync(live)) return;
  fs.renameSync(previous, live);
}

if (!fs.existsSync(nextBin)) {
  fail("Brak next/dist/bin/next — uruchom npm ci.");
}

fs.rmSync(staging, { recursive: true, force: true });

const env = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV || "production",
  NEXT_DIST_DIR: ".next-build",
};

console.log(JSON.stringify({ ok: true, step: "atomic-build-start", distDir: ".next-build" }));

const build = spawnSync(process.execPath, [nextBin, "build"], {
  cwd: root,
  env,
  stdio: "inherit",
});

if (build.status !== 0) {
  fs.rmSync(staging, { recursive: true, force: true });
  fail("next build nie powiódł się", { status: build.status });
}

if (!fs.existsSync(path.join(staging, "BUILD_ID"))) {
  fs.rmSync(staging, { recursive: true, force: true });
  fail("Brak BUILD_ID w .next-build");
}

fs.rmSync(previous, { recursive: true, force: true });
try {
  if (fs.existsSync(live)) fs.renameSync(live, previous);
  fs.renameSync(staging, live);
} catch (err) {
  restorePrevious();
  fail(err instanceof Error ? err.message : String(err));
}

const buildId = fs.readFileSync(path.join(live, "BUILD_ID"), "utf8").trim();
console.log(
  JSON.stringify({
    ok: true,
    step: "atomic-build-swapped",
    buildId,
    keptPrevious: fs.existsSync(previous),
  }),
);

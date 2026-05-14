#!/usr/bin/env node
/**
 * E2E weryfikacja reconciliacji na **lokalnym** świeżym buildzie:
 * 1) Uruchamia `next start` na wolnym porcie (domyślnie 3010), żeby nie kolidować z PM2:3000.
 * 2) Czeka na `/api/health`.
 * 3) Uruchamia `postdeploy-smoke.cjs` z SMOKE_MOBILE_RECON włączonym (pełny zestaw).
 * 4) Zatrzymuje proces Next.
 *
 * Zmienne:
 *   VERIFY_PORT — port (domyślnie 3010)
 *   SKIP_BUILD=1 — pomiń `npm run build` (szybciej, jeśli dopiero zbudowano)
 */

const { spawn, execFileSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const port = String(process.env.VERIFY_PORT || '3010').trim() || '3010';
const baseUrl = `http://127.0.0.1:${port}`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForHealth(maxMs) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.status === 200 || res.status === 503) return true;
    } catch {
      /* port not ready */
    }
    await sleep(400);
  }
  return false;
}

async function main() {
  if (!process.env.SKIP_BUILD) {
    console.log('[verify:recon] npm run build …');
    execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit', env: process.env });
  } else {
    console.log('[verify:recon] SKIP_BUILD=1 — pomijam build');
  }

  console.log(`[verify:recon] starting Next on port ${port} …`);

  const child = spawn('npx', ['next', 'start', '-p', port], {
    cwd: root,
    env: { ...process.env, NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  let stderr = '';
  child.stderr?.on('data', (d) => {
    stderr += d.toString();
  });

  const kill = () => {
    try {
      child.kill('SIGTERM');
    } catch {
      /* ignore */
    }
  };
  process.on('SIGINT', () => {
    kill();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    kill();
    process.exit(143);
  });

  const ok = await waitForHealth(90_000);
  if (!ok) {
    kill();
    console.error('[verify:recon] TIMEOUT: /api/health nie odpowiedział w czasie.');
    console.error(stderr.slice(-4000));
    process.exitCode = 1;
    return;
  }

  console.log(`[verify:recon] health OK → smoke (${baseUrl}, pełny mobile recon) …`);

  try {
    execFileSync(process.execPath, [path.join(__dirname, 'postdeploy-smoke.cjs')], {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, SMOKE_BASE_URL: baseUrl, SMOKE_MOBILE_RECON: '1' },
    });
  } catch {
    process.exitCode = 1;
  } finally {
    kill();
    await sleep(500);
  }

  if (process.exitCode) {
    console.error('[verify:recon] smoke FAILED');
  } else {
    console.log('[verify:recon] smoke PASSED');
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

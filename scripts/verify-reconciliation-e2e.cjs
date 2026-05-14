#!/usr/bin/env node
/**
 * E2E weryfikacja reconciliacji na **lokalnym** świeżym buildzie:
 * 1) Uruchamia `next start` na wolnym porcie, żeby nie kolidować z PM2:3000 ani starymi verify.
 * 2) Czeka na `/api/health`.
 * 3) Uruchamia `postdeploy-smoke.cjs` z SMOKE_MOBILE_RECON włączonym (pełny zestaw).
 * 4) Zatrzymuje proces Next.
 *
 * Zmienne:
 *   VERIFY_PORT — port (opcjonalnie; bez tego dobierany automatycznie)
 *   SKIP_BUILD=1 — pomiń `npm run build` (szybciej, jeśli dopiero zbudowano)
 *   VERIFY_SKIP_DB_PUSH=1 — pomiń `prisma db push` (np. gdy DB jest tylko read-only)
 *   VERIFY_SKIP_SMOKE=1 — pomiń smoke (szybki test samej orkiestracji procesu)
 *   Czekanie na health: do ~45 s, poll co 250 ms.
 */

const { spawn, execFileSync } = require('child_process');
const net = require('net');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');

try {
  require('dotenv').config({ path: path.join(root, '.env') });
} catch {
  /* optional */
}

let port = String(process.env.VERIFY_PORT || '').trim();
let baseUrl = '';
const debugHandles = ['1', 'true', 'yes'].includes(
  String(process.env.VERIFY_DEBUG_HANDLES || '').trim().toLowerCase()
);
const skipSmoke = ['1', 'true', 'yes'].includes(
  String(process.env.VERIFY_SKIP_SMOKE || '').trim().toLowerCase()
);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function dumpActiveHandles(tag) {
  if (!debugHandles || typeof process._getActiveHandles !== 'function') return;
  const handles = process._getActiveHandles();
  const names = handles.map((h) => (h && h.constructor && h.constructor.name) || typeof h);
  console.log(
    `[verify:recon][debug] active handles ${tag}: count=${handles.length} types=${names.join(', ')}`
  );
}

function hasProductionBuild() {
  return fs.existsSync(path.join(root, '.next', 'BUILD_ID'));
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const selected = address && typeof address === 'object' ? String(address.port) : '';
      server.close(() => resolve(selected));
    });
  });
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
    await sleep(250);
  }
  return false;
}

async function main() {
  if (!process.env.SKIP_BUILD) {
    console.log('[verify:recon] npm run build …');
    execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit', env: process.env });
  } else {
    console.log('[verify:recon] SKIP_BUILD=1 — pomijam build');
    if (!hasProductionBuild()) {
      throw new Error('SKIP_BUILD=1, ale brak .next/BUILD_ID — najpierw uruchom npm run build.');
    }
  }

  if (!['1', 'true', 'yes'].includes(String(process.env.VERIFY_SKIP_DB_PUSH || '').toLowerCase())) {
    console.log('[verify:recon] prisma db push (schema → DB, np. agentCommissionPercent) …');
    try {
      execFileSync('npx', ['prisma', 'db', 'push'], { cwd: root, stdio: 'inherit', env: process.env });
    } catch {
      console.warn(
        '[verify:recon] prisma db push FAILED — uruchom ręcznie SQL: docs/reconciliation/sql/add_agent_commission_percent.sql'
      );
    }
  } else {
    console.log('[verify:recon] VERIFY_SKIP_DB_PUSH=1 — pomijam db push');
  }

  if (!port) {
    port = await getFreePort();
  }
  if (!port) {
    throw new Error('Nie udało się dobrać wolnego portu verify.');
  }
  baseUrl = `http://127.0.0.1:${port}`;

  console.log(`[verify:recon] starting Next on port ${port} …`);

  const childEnv = { ...process.env, NODE_ENV: 'production' };
  if (!String(childEnv.PASSKEY_RP_ID || '').trim()) {
    childEnv.PASSKEY_RP_ID = 'estateos.pl';
  }
  if (!String(childEnv.PASSKEY_ORIGIN || '').trim()) {
    childEnv.PASSKEY_ORIGIN = String(childEnv.NEXTAUTH_URL || '').trim() || 'https://estateos.pl';
  }

  const nextBin = require.resolve('next/dist/bin/next', { paths: [root] });
  const child = spawn(process.execPath, [nextBin, 'start', '-p', port], {
    cwd: root,
    env: childEnv,
    stdio: 'inherit',
    detached: false,
  });

  const waitChildExit = (maxMs) =>
    new Promise((resolve) => {
      if (child.exitCode !== null) return resolve(true);
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve(true);
      };
      child.once('exit', done);
      const t = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.removeListener('exit', done);
        resolve(false);
      }, maxMs);
      if (typeof t.unref === 'function') t.unref();
    });

  const terminateChildTree = async () => {
    if (child.exitCode !== null) return;
    try {
      child.kill('SIGTERM');
    } catch {
      /* ignore */
    }
    const exitedGracefully = await waitChildExit(3000);
    if (exitedGracefully || child.exitCode !== null) return;
    try {
      child.kill('SIGKILL');
    } catch {
      /* ignore */
    }
    await waitChildExit(1000);
  };

  let handlingSignal = false;
  const onSigint = () => {
    if (handlingSignal) return;
    handlingSignal = true;
    terminateChildTree().finally(() => process.exit(130));
  };
  const onSigterm = () => {
    if (handlingSignal) return;
    handlingSignal = true;
    terminateChildTree().finally(() => process.exit(143));
  };
  process.once('SIGINT', onSigint);
  process.once('SIGTERM', onSigterm);

  const ok = await waitForHealth(45_000);
  if (!ok) {
    await terminateChildTree();
    process.removeListener('SIGINT', onSigint);
    process.removeListener('SIGTERM', onSigterm);
    dumpActiveHandles('after-timeout-cleanup');
    console.error('[verify:recon] TIMEOUT: /api/health nie odpowiedział w czasie.');
    process.exitCode = 1;
    return;
  }

  if (!skipSmoke) {
    console.log(`[verify:recon] health OK → smoke (${baseUrl}, pełny mobile recon) …`);
  } else {
    console.log('[verify:recon] VERIFY_SKIP_SMOKE=1 — pomijam smoke (test orkiestracji)');
  }

  try {
    if (!skipSmoke) {
      execFileSync(process.execPath, [path.join(__dirname, 'postdeploy-smoke.cjs')], {
        cwd: root,
        stdio: 'inherit',
        env: { ...process.env, SMOKE_BASE_URL: baseUrl, SMOKE_MOBILE_RECON: '1' },
      });
    }
  } catch {
    process.exitCode = 1;
  } finally {
    await terminateChildTree();
    process.removeListener('SIGINT', onSigint);
    process.removeListener('SIGTERM', onSigterm);
    dumpActiveHandles('after-finally-cleanup');
  }

  if (process.exitCode) {
    console.error('[verify:recon] smoke FAILED');
  } else {
    if (!skipSmoke) console.log('[verify:recon] smoke PASSED');
    else console.log('[verify:recon] orchestration PASSED');
  }
  dumpActiveHandles('before-exit');
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

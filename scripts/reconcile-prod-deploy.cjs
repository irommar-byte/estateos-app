#!/usr/bin/env node
/**
 * analiza → pull → check → [verify:recon tylko gdy DEPLOY_RUN_VERIFY_E2E=1] → SQL → release:ship → smoke → przy fail: reset + release:ship
 * Uruchom w katalogu repo na serwerze, z .env (DATABASE_URL, NEXTAUTH_URL).
 *
 * DEPLOY_BRANCH — domyślnie recovery-local-snapshot
 * DEPLOY_REMOTE — domyślnie origin
 * SMOKE_BASE_URL — domyślnie z NEXTAUTH_URL
 * DEPLOY_RUN_VERIFY_E2E=1 — uruchom pełny verify:recon (build + lokalny next + smoke); domyślnie OFF (szybszy deploy).
 * DEPLOY_SKIP_VERIFY_E2E=0 — to samo co wyżej (wymuś verify); legacy: DEPLOY_SKIP_VERIFY_E2E=1 nadal pomija verify.
 * DEPLOY_ALLOW_DIRTY=1 — pozwól uruchomić deploy przy lokalnych zmianach (tylko diagnostyka/awaryjnie).
 */

const { spawnSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
process.chdir(root);

try {
  require('dotenv').config({ path: path.join(root, '.env') });
} catch {
  /* optional */
}

const branch = String(process.env.DEPLOY_BRANCH || 'recovery-local-snapshot').trim();
const remote = String(process.env.DEPLOY_REMOTE || 'origin').trim();
const legacySkip = ['1', 'true', 'yes'].includes(
  String(process.env.DEPLOY_SKIP_VERIFY_E2E || '').trim().toLowerCase()
);
const runVerify = ['1', 'true', 'yes'].includes(
  String(process.env.DEPLOY_RUN_VERIFY_E2E || '').trim().toLowerCase()
);
const legacyForce = ['0', 'false', 'no'].includes(
  String(process.env.DEPLOY_SKIP_VERIFY_E2E || '').trim().toLowerCase()
);
const allowDirty = ['1', 'true', 'yes'].includes(
  String(process.env.DEPLOY_ALLOW_DIRTY || '').trim().toLowerCase()
);
/** Domyślnie pomijamy verify:recon (oszczędność czasu); pełna weryfikacja tylko na żądanie. */
const skipE2e = legacySkip || (!runVerify && !legacyForce);

const sqlAgentCommissionFile = path.join(
  root,
  'docs/reconciliation/sql/add_agent_commission_percent.sql'
);
const sqlLegalVerificationFile = path.join(
  root,
  'docs/reconciliation/sql/add_legal_verification_request.sql'
);
const sqlOfferLandLegalColumnsFile = path.join(
  root,
  'docs/reconciliation/sql/add_offer_land_registry_and_legal_columns_if_missing.sql'
);

const summary = {
  rollbackSha: null,
  headAfterPull: null,
  sqlAgentCommission: null,
  sqlLegalVerification: null,
  sqlOfferLandLegal: null,
  check: null,
  verifyE2e: null,
  releaseShip: null,
  smoke: null,
  rolledBack: false,
  finalSmoke: null,
  error: null,
};

function run(cmd, args, extraEnv = {}) {
  const r = spawnSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv },
    shell: false,
  });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  return { ok: r.status === 0, status: r.status, out };
}

function gitRevParse() {
  const r = run('git', ['rev-parse', 'HEAD']);
  if (!r.ok) throw new Error(`git rev-parse: ${r.out}`);
  return r.out.trim();
}

function smokeBaseUrl() {
  const explicit = String(process.env.SMOKE_BASE_URL || '').trim().replace(/\/$/, '');
  if (explicit) return explicit;
  const nu = String(process.env.NEXTAUTH_URL || '').trim();
  try {
    const u = new URL(nu);
    return `${u.protocol}//${u.host}`;
  } catch {
    throw new Error('Ustaw SMOKE_BASE_URL lub NEXTAUTH_URL w .env');
  }
}

function dirtyWorkingTree() {
  const r = run('git', ['status', '--porcelain']);
  return r.ok && String(r.out || '').trim().length > 0;
}

function sqlDuplicateColumn(out) {
  return /Duplicate column name|1060|ER_DUP_FIELDNAME|already exists/i.test(String(out || ''));
}

function resetHard(sha) {
  const r = run('git', ['reset', '--hard', sha]);
  if (!r.ok) throw new Error(`git reset --hard: ${r.out}`);
}

function releaseShipOrThrow(label) {
  const ship = run('npm', ['run', 'release:ship']);
  if (!ship.ok) {
    summary.error = (summary.error || '') + `\n[${label}] release:ship\n` + ship.out.slice(-8000);
    throw new Error(`release:ship FAIL (${label})`);
  }
}

function main() {
  console.log('[deploy:recon] analiza');
  if (!allowDirty && dirtyWorkingTree()) {
    throw new Error('Brudny working tree — zacommituj lub stash.');
  }

  summary.rollbackSha = gitRevParse();
  const b = run('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  console.log('[deploy:recon] HEAD przed pull:', summary.rollbackSha, 'branch:', b.out.trim());

  console.log('[deploy:recon] git fetch / checkout / pull');
  let r = run('git', ['fetch', remote]);
  if (!r.ok) throw new Error(`git fetch: ${r.out}`);
  r = run('git', ['checkout', branch]);
  if (!r.ok) throw new Error(`git checkout: ${r.out}`);
  r = run('git', ['pull', remote, branch]);
  if (!r.ok) throw new Error(`git pull: ${r.out}`);
  summary.headAfterPull = gitRevParse();
  console.log('[deploy:recon] HEAD po pull:', summary.headAfterPull);

  console.log('[deploy:recon] prisma generate');
  r = run('npx', ['prisma', 'generate']);
  if (!r.ok) {
    summary.error = r.out.slice(-4000);
    throw new Error('prisma:generate');
  }

  console.log('[deploy:recon] verify: npm run check');
  r = run('npm', ['run', 'check']);
  summary.check = r.ok ? 'PASS' : 'FAIL';
  if (!r.ok) {
    summary.error = r.out.slice(-4000);
    throw new Error('check');
  }

  if (!skipE2e) {
    console.log('[deploy:recon] verify:recon (VERIFY_SKIP_DB_PUSH=1)');
    r = run('npm', ['run', 'verify:recon'], {
      VERIFY_SKIP_DB_PUSH: '1',
    });
    summary.verifyE2e = r.ok ? 'PASS' : 'FAIL';
    if (!r.ok) {
      summary.error = r.out.slice(-6000);
      throw new Error('verify:recon');
    }
  } else {
    summary.verifyE2e = 'SKIP';
  }

  console.log('[deploy:recon] SQL prisma db execute (agent commission)');
  r = run('npx', ['prisma', 'db', 'execute', '--file', sqlAgentCommissionFile]);
  if (r.ok) summary.sqlAgentCommission = 'APPLIED';
  else if (sqlDuplicateColumn(r.out)) summary.sqlAgentCommission = 'SKIP_DUPLICATE';
  else {
    summary.sqlAgentCommission = 'FAIL';
    summary.error = r.out.slice(-4000);
    throw new Error('sql:agentCommission');
  }

  console.log('[deploy:recon] SQL prisma db execute (legal verification request table)');
  r = run('npx', ['prisma', 'db', 'execute', '--file', sqlLegalVerificationFile]);
  if (r.ok) summary.sqlLegalVerification = 'APPLIED';
  else if (sqlDuplicateColumn(r.out)) summary.sqlLegalVerification = 'SKIP_DUPLICATE';
  else {
    summary.sqlLegalVerification = 'FAIL';
    summary.error = r.out.slice(-4000);
    throw new Error('sql:legalVerification');
  }

  console.log('[deploy:recon] SQL prisma db execute (Offer land + legal columns, idempotent)');
  r = run('npx', ['prisma', 'db', 'execute', '--file', sqlOfferLandLegalColumnsFile]);
  if (r.ok) summary.sqlOfferLandLegal = 'APPLIED';
  else {
    summary.sqlOfferLandLegal = 'FAIL';
    summary.error = r.out.slice(-4000);
    throw new Error('sql:offerLandLegal');
  }

  console.log('[deploy:recon] release:ship');
  releaseShipOrThrow('deploy');
  summary.releaseShip = 'PASS';

  const base = smokeBaseUrl();
  console.log('[deploy:recon] smoke', base);
  r = run('npm', ['run', 'smoke:postdeploy'], { SMOKE_BASE_URL: base });
  summary.smoke = r.ok ? 'PASS' : 'FAIL';
  if (!r.ok) {
    summary.error = r.out.slice(-8000);
    throw new Error('smoke');
  }
}

function rollback(reason) {
  console.error('[deploy:recon] ROLLBACK:', reason);
  summary.rolledBack = true;
  try {
    if (!summary.rollbackSha) {
      throw new Error('rollback SHA is missing');
    }
    resetHard(summary.rollbackSha);
    releaseShipOrThrow('rollback');
    const base = smokeBaseUrl();
    const sm = run('npm', ['run', 'smoke:postdeploy'], { SMOKE_BASE_URL: base });
    summary.finalSmoke = sm.ok ? 'PASS' : 'FAIL';
  } catch (e) {
    summary.finalSmoke = 'FAIL';
    summary.error = (summary.error || '') + '\n' + String(e.message || e);
  }
}

try {
  main();
} catch (e) {
  const tag = e.message || String(e);
  console.error('[deploy:recon] FAIL:', tag);
  rollback(tag);
  printReport(false);
  process.exit(1);
}

printReport(true);
process.exit(0);

function printReport(ok) {
  let base = '—';
  try {
    base = smokeBaseUrl();
  } catch {
    /* */
  }
  console.log('\n========== deploy:recon ==========');
  console.log('wynik:', ok ? 'OK' : 'FAIL');
  console.log('prod URL (smoke):', base);
  console.log('SHA przed pull:', summary.rollbackSha);
  console.log('SHA po pull:', summary.headAfterPull);
  console.log('SQL agentCommission:', summary.sqlAgentCommission);
  console.log('SQL legalVerification:', summary.sqlLegalVerification);
  console.log('SQL offerLandLegal:', summary.sqlOfferLandLegal);
  console.log('check:', summary.check);
  console.log('verify:recon:', summary.verifyE2e);
  console.log('release:ship:', summary.releaseShip);
  console.log('smoke:', summary.smoke);
  console.log('rollback:', summary.rolledBack);
  console.log('smoke po rollback:', summary.finalSmoke ?? '—');
  if (!ok && summary.error) console.log('błąd:\n', String(summary.error).slice(-2500));
  console.log('==================================\n');
}

#!/usr/bin/env node
/**
 * Appends one JSON line to .deploy/deploy-history.jsonl (gitignored runtime log).
 * Env: APP_ROOT, DEPLOY_STATUS (success|failure), DEPLOY_DURATION_SEC, DEPLOY_EXIT,
 *      DEPLOY_SHA, DEPLOY_BRANCH, DEPLOY_ECOSYSTEM, DEPLOY_ROLLBACK_SHA (optional),
 *      DEPLOY_RELEASE_ID, DEPLOY_RELEASE_IMMUTABLE (1|0)
 */
const fs = require('fs');
const path = require('path');

const APP_ROOT = process.env.APP_ROOT || path.join(__dirname, '..');
const dir = path.join(APP_ROOT, '.deploy');
const file = path.join(dir, 'deploy-history.jsonl');

const row = {
  ts: new Date().toISOString(),
  status: process.env.DEPLOY_STATUS || 'unknown',
  exitCode: Number(process.env.DEPLOY_EXIT || 0),
  durationSec: Number(process.env.DEPLOY_DURATION_SEC || 0),
  sha: process.env.DEPLOY_SHA || '',
  branch: process.env.DEPLOY_BRANCH || '',
  ecosystem: process.env.DEPLOY_ECOSYSTEM || '',
  rollbackSha: process.env.DEPLOY_ROLLBACK_SHA || '',
  releaseId: process.env.DEPLOY_RELEASE_ID || '',
  releaseImmutable: process.env.DEPLOY_RELEASE_IMMUTABLE === '1',
  pm2App: process.env.PM2_APP || '',
  hostname: process.env.DEPLOY_HOSTNAME || require('os').hostname(),
};

try {
  fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(file, JSON.stringify(row) + '\n', { mode: 0o600 });
} catch (e) {
  console.error('record-deploy-metadata:', e.message);
  process.exitCode = 0;
}

#!/usr/bin/env node
/**
 * Verifies required production env keys are set (values never printed).
 * Exit 1 if anything missing when NODE_ENV=production in .env or VERIFY_PROD=1.
 */
const fs = require('fs');
const path = require('path');
const { config } = require('dotenv');

const APP_ROOT = process.env.APP_ROOT || path.join(__dirname, '..');
config({ path: path.join(APP_ROOT, '.env'), quiet: true });

function isSet(key) {
  const v = process.env[key];
  return Boolean(v && String(v).trim());
}

const errors = [];

if (!isSet('DATABASE_URL')) errors.push('DATABASE_URL');

if (!isSet('NEXTAUTH_SECRET') && !isSet('JWT_SECRET') && !isSet('AUTH_SECRET')) {
  errors.push('NEXTAUTH_SECRET|JWT_SECRET|AUTH_SECRET (at least one)');
}

const nodeEnv = process.env.NODE_ENV || '';
const treatAsProd =
  nodeEnv === 'production' || process.env.VERIFY_PROD === '1';

if (treatAsProd && !isSet('PASSKEY_RP_ID')) {
  errors.push('PASSKEY_RP_ID');
}

if (errors.length) {
  console.error('verify-prod-env: missing:', errors.join(', '));
  process.exit(1);
}

console.log('verify-prod-env: OK (critical keys present).');

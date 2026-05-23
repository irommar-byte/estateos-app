#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const helperPath = path.join(__dirname, '..', 'src', 'lib', 'mobileIapEntitlements.ts');
const source = fs.readFileSync(helperPath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;

const sandbox = {
  exports: {},
  module: { exports: {} },
  require,
};
sandbox.exports = sandbox.module.exports;
vm.runInNewContext(compiled, sandbox, { filename: helperPath });

const {
  buildPakietPlusUserUpdate,
  isPakietPlusProductId,
} = sandbox.module.exports;

const user = {
  isPro: false,
  planType: null,
  proExpiresAt: null,
  extraListings: 0,
  plusExpiresAt: null,
};

assert.equal(isPakietPlusProductId('pl.estateos.app.pakiet_plus_30d'), true);

const update = buildPakietPlusUserUpdate(new Date('2026-01-01T00:00:00.000Z'));

assert.deepEqual(Object.keys(update).sort(), ['extraListings', 'plusExpiresAt']);
assert.equal('isPro' in update, false);
assert.equal('planType' in update, false);
assert.equal('proExpiresAt' in update, false);

user.extraListings += update.extraListings.increment;
user.plusExpiresAt = update.plusExpiresAt;

assert.equal(user.extraListings, 1);
assert.equal(user.isPro, false);
assert.notEqual(user.planType, 'PRO');
assert.notEqual(user.planType, 'PLUS');
assert.equal(user.proExpiresAt, null);
assert.equal(user.plusExpiresAt.toISOString(), '2026-01-31T00:00:00.000Z');

for (const route of [
  path.join(__dirname, '..', 'src', 'app', 'api', 'mobile', 'v1', 'iap', 'verify', 'route.ts'),
  path.join(__dirname, '..', 'src', 'app', 'api', 'mobile', 'v1', 'iap', 'pakiet-plus', 'route.ts'),
]) {
  const routeSource = fs.readFileSync(route, 'utf8');
  assert.equal(/isPro\s*:\s*true/.test(routeSource), false, `${route} must not grant PRO from Pakiet Plus`);
  assert.equal(/planType\s*:\s*['"`]PRO/.test(routeSource), false, `${route} must not set planType=PRO`);
  assert.equal(/planType\s*:\s*['"`]PLUS/.test(routeSource), false, `${route} must not set planType=PLUS`);
  assert.equal(/proExpiresAt\s*:/.test(routeSource), false, `${route} must not update proExpiresAt`);
  assert.match(routeSource, /verified\s*:\s*true/, `${route} must return verified=true for successful Plus verification`);
  assert.match(routeSource, /extraListings/, `${route} must return current extraListings`);
}

const stripeWebhook = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'app', 'api', 'stripe', 'webhook', 'route.ts'),
  'utf8'
);
const pakietPlusWebhookBranch =
  stripeWebhook.match(/rawPlanType === 'pakiet_plus'[\s\S]*?\}\s*else\s*\{/)?.[0] || '';
assert.equal(/offer\.create|expiresAt|renew|reactivate|extend/i.test(pakietPlusWebhookBranch), false);

const offerService = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'services', 'offer.service.ts'), 'utf8');
assert.match(offerService, /extraListings:\s*\{\s*decrement:\s*1\s*\}/, 'Plus credit must be consumed when used');
assert.match(offerService, /expiresAt\s*=\s*plusOfferExpiresAt\(\)/, 'Plus-created offer must receive 30-day expiry');

console.log('Pakiet Plus regression passed.');

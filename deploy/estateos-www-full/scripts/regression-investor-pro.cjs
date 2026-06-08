#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

function loadTsModule(relPath) {
  const filePath = path.join(__dirname, '..', relPath);
  const source = fs.readFileSync(filePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const sandbox = { exports: {}, module: { exports: {} }, require };
  sandbox.exports = sandbox.module.exports;
  vm.runInNewContext(compiled, sandbox, { filename: filePath });
  return sandbox.module.exports;
}

const period = loadTsModule('src/lib/investorProMembership.ts');

const grantSource = fs.readFileSync(path.join(__dirname, '..', 'src/lib/investorProGrant.ts'), 'utf8');
const iapSource = fs.readFileSync(path.join(__dirname, '..', 'src/lib/mobileIapEntitlements.ts'), 'utf8');
assert.match(grantSource, /INVESTOR_PRO_MONTHLY_CREDITS/);
assert.match(grantSource, /plusExpiresAt:\s*proExpiresAt/);
assert.match(grantSource, /shouldBackfillInvestorProCredits/);
assert.match(grantSource, /buildInvestorProCreditsBackfillData/);
assert.match(iapSource, /INVESTOR_PRO_MONTHLY_CREDITS\s*=\s*10/);

const now = new Date('2026-06-08T12:00:00.000Z');
const expiry = new Date('2026-07-08T12:00:00.000Z');
const status = period.buildInvestorProPeriodStatus(expiry, now);
assert.equal(status.daysLeft, 30);
assert.ok(status.progressElapsed < 0.05, 'fresh period should not look almost expired');

const mid = period.buildInvestorProPeriodStatus(new Date(now.getTime() + 15 * 86400000), now);
assert.ok(mid.progressElapsed > 0.45 && mid.progressElapsed < 0.55);

console.log('regression-investor-pro: ok');

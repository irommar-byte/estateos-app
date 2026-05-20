#!/usr/bin/env node
/**
 * Regresja: E.164 przy rejestracji i wariantach wyszukiwania.
 * Uruchom: node scripts/regression-phone-e164.cjs
 */
const path = require('path');
const ts = require('typescript');
const fs = require('fs');

function loadPhoneE164() {
  const file = path.join(__dirname, '../src/lib/phoneE164.ts');
  const source = fs.readFileSync(file, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  const mod = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function('exports', 'require', outputText)(mod.exports, require);
  return mod.exports;
}

const { normalizePhoneE164, buildPhoneLookupVariants, normalizePhoneForSms } = loadPhoneE164();

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

const de = normalizePhoneE164('+49 170 1234567');
assert(de === '+491701234567', `DE E.164 expected +491701234567 got ${de}`);

const pl = normalizePhoneE164('501234567');
assert(pl === '+48501234567', `PL 9-digit expected +48501234567 got ${pl}`);

const pl48 = normalizePhoneE164('48501234567');
assert(pl48 === '+48501234567', `PL 11-digit expected +48501234567 got ${pl48}`);

const variants = buildPhoneLookupVariants('+491701234567');
assert(variants.includes('+491701234567'), 'variants must include E.164');

const smsDe = normalizePhoneForSms('+491701234567');
assert(smsDe === '491701234567', `SMS DE digits expected 491701234567 got ${smsDe}`);

const smsPl = normalizePhoneForSms('501234567');
assert(smsPl === '48501234567', `SMS PL legacy 9-digit got ${smsPl}`);

console.log('OK: regression-phone-e164');

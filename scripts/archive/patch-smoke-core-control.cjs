#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const target = process.argv[2] || path.join(process.env.HOME || '', 'estateos/scripts/postdeploy-smoke.cjs');
let text = fs.readFileSync(target, 'utf8');

if (text.includes('core start requires auth')) {
  console.log('smoke: already patched');
  process.exit(0);
}

const insert = `  {
    name: 'mobile admin core start requires auth',
    url: '/api/mobile/v1/admin/core/start',
    method: 'POST',
    expectStatus: [401],
  },
  {
    name: 'mobile admin core stop requires auth',
    url: '/api/mobile/v1/admin/core/stop',
    method: 'POST',
    expectStatus: [401],
  },`;

const marker = "url: '/api/mobile/v1/admin/core/metrics',";
const idx = text.indexOf(marker);
if (idx < 0) throw new Error('metrics marker not found');
const close = text.indexOf('},', idx);
if (close < 0) throw new Error('metrics block end not found');
text = text.slice(0, close + 3) + '\n' + insert + text.slice(close + 3);
fs.writeFileSync(target, text);
console.log('smoke: patched', target);

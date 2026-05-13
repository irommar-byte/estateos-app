#!/usr/bin/env node

const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000';

const checks = [
  { name: 'health', url: '/api/health', expectStatus: [200, 503] },
  { name: 'assetlinks', url: '/.well-known/assetlinks.json', expectStatus: [200] },
  { name: 'aasa well-known', url: '/.well-known/apple-app-site-association', expectStatus: [200] },
  { name: 'aasa root', url: '/apple-app-site-association', expectStatus: [200] },
  { name: 'passkeys auth options', url: '/api/passkeys/auth-options', method: 'GET', expectStatus: [200, 429] },
];

(async () => {
  let failed = false;

  for (const check of checks) {
    const method = check.method || 'GET';
    const url = `${baseUrl}${check.url}`;

    try {
      const response = await fetch(url, { method });
      const ok = check.expectStatus.includes(response.status);
      console.log(`[${ok ? 'PASS' : 'FAIL'}] ${check.name} ${response.status} ${url}`);
      if (!ok) failed = true;
    } catch (error) {
      console.log(`[FAIL] ${check.name} request error ${url} :: ${error.message}`);
      failed = true;
    }
  }

  if (failed) {
    process.exitCode = 1;
    return;
  }

  console.log('Smoke checks passed.');
})();

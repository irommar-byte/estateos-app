#!/usr/bin/env node

const baseUrl = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000';

const checks = [
  { name: 'health', url: '/api/health', expectStatus: [200] },
  { name: 'auth session', url: '/api/auth/session', expectStatus: [200] },
  { name: 'passkeys auth-options (public)', url: '/api/passkeys/auth-options', expectStatus: [200], parseJson: true },
  { name: 'public offer api (sample id)', url: '/api/offers/1', expectStatus: [200, 404] },
  { name: 'aasa root', url: '/apple-app-site-association', expectStatus: [200], parseJson: true },
  {
    name: 'aasa well-known',
    url: '/.well-known/apple-app-site-association',
    expectStatus: [200],
    parseJson: true,
  },
  {
    name: 'assetlinks well-known',
    url: '/.well-known/assetlinks.json',
    expectStatus: [200],
    parseJson: true,
  },
  {
    name: 'passkeys register-options (unauth)',
    url: '/api/passkeys/register-options',
    method: 'GET',
    expectStatus: [401],
  },
];

function assertJsonBody(name, text) {
  try {
    JSON.parse(text);
  } catch {
    throw new Error(`${name}: response is not valid JSON`);
  }
}

(async () => {
  let failed = false;

  for (const check of checks) {
    const method = check.method || 'GET';
    const url = `${baseUrl}${check.url}`;

    try {
      const response = await fetch(url, { method });
      const ok = check.expectStatus.includes(response.status);
      console.log(`[${ok ? 'PASS' : 'FAIL'}] ${check.name} ${response.status} ${url}`);
      if (!ok) {
        failed = true;
        continue;
      }
      if (check.parseJson && response.ok) {
        const text = await response.text();
        try {
          assertJsonBody(check.name, text);
        } catch (e) {
          console.log(`[FAIL] ${e.message}`);
          failed = true;
        }
      }
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

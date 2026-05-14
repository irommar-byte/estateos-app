#!/usr/bin/env node

/**
 * Smoke po deployu.
 *
 * Zmienne:
 *   SMOKE_BASE_URL       — domyślnie http://127.0.0.1:3000 (np. https://estateos.pl)
 *   SMOKE_MOBILE_RECON   — "0"|"false"|"no" = pomiń testy reconciliacji mobile (push-token + admin 401).
 *                          Użyj przy SMOKE_BASE_URL=produkcja **zanim** wdrożysz nowy build z tymi route’ami.
 *
 * Po wdrożeniu reconciliacji na prod: **nie** ustawiaj SMOKE_MOBILE_RECON=0 — pełny smoke ma być zielony.
 */

const baseUrl = (process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');

const skipMobileRecon = ['0', 'false', 'no'].includes(
  String(process.env.SMOKE_MOBILE_RECON || '').trim().toLowerCase()
);

/** Zawsze — nie zależą od ostatniego deployu reconciliacji. */
const coreChecks = [
  { name: 'health', url: '/api/health', expectStatus: [200, 503] },
  { name: 'mobile discovery feed requires auth', url: '/api/mobile/v1/discovery/feed', expectStatus: [401] },
  { name: 'offers catalog', url: '/api/offers', expectStatus: [200] },
  { name: 'assetlinks', url: '/.well-known/assetlinks.json', expectStatus: [200] },
  { name: 'aasa well-known', url: '/.well-known/apple-app-site-association', expectStatus: [200] },
  { name: 'aasa root', url: '/apple-app-site-association', expectStatus: [200] },
  { name: 'passkeys auth options', url: '/api/passkeys/auth-options', method: 'GET', expectStatus: [200, 429] },
];

/**
 * Wymagają buildu z reconciliacji (route push-token + requireMobileAdmin na admin mobile).
 * Na starej produkcji: 404 / 200 zamiast 200 / 401 — wtedy albo deploy, albo SMOKE_MOBILE_RECON=0.
 */
const mobileReconciliationChecks = [
  { name: 'mobile push-token probe', url: '/api/mobile/v1/user/push-token', expectStatus: [200] },
  { name: 'mobile admin users requires auth', url: '/api/mobile/v1/admin/users', expectStatus: [401] },
  { name: 'mobile admin offers requires auth', url: '/api/mobile/v1/admin/offers', expectStatus: [401] },
  { name: 'mobile admin radar-analytics requires auth', url: '/api/mobile/v1/admin/radar-analytics', expectStatus: [401] },
  {
    name: 'mobile admin legal-verification requires auth',
    url: '/api/mobile/v1/admin/legal-verification',
    expectStatus: [401],
  },
  {
    name: 'mobile legal-verification alias requires auth',
    url: '/api/mobile/v1/legal-verification',
    expectStatus: [401],
  },
  {
    name: 'mobile offer legal-verification status requires auth',
    url: '/api/mobile/v1/offers/153/legal-verification',
    expectStatus: [401],
  },
  {
    name: 'mobile offer legal-verification submit requires auth',
    url: '/api/mobile/v1/offers/153/legal-verification/submit',
    method: 'POST',
    expectStatus: [401],
  },
  {
    name: 'mobile admin legal-verification approve requires auth',
    url: '/api/mobile/v1/admin/legal-verification/153/approve',
    method: 'POST',
    expectStatus: [401],
  },
  {
    name: 'mobile admin legal-verification reject requires auth',
    url: '/api/mobile/v1/admin/legal-verification/153/reject',
    method: 'POST',
    expectStatus: [401],
  },
];

function isProductionishHost(url) {
  return /estateos\.pl/i.test(url);
}

(async () => {
  let failed = false;

  if (skipMobileRecon) {
    console.log(
      '[INFO] SMOKE_MOBILE_RECON=0 — pomijam testy reconciliacji mobile (push-token + admin 401).'
    );
  }

  const checks = [...coreChecks, ...(skipMobileRecon ? [] : mobileReconciliationChecks)];

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

  if (failed && !skipMobileRecon && isProductionishHost(baseUrl)) {
    console.log('');
    console.log(
      '[HINT] Produkcja może jeszcze nie mieć wdrożonego buildu z reconciliacją (push-token, admin JWT).'
    );
    console.log('       Wdróż: npm run release:ship (lub deploy:server-only), potem powtórz smoke.');
    console.log(
      '       Tymczasem (tylko przed deployem): SMOKE_MOBILE_RECON=0 npm run smoke:postdeploy'
    );
  }

  if (failed) {
    process.exitCode = 1;
    return;
  }

  console.log('Smoke checks passed.');
})();

/**
 * HTTP smoke for Desk API — auth + IDOR (no session = 403).
 */
const BASE = process.env.SMOKE_BASE || 'http://localhost:3099';

async function req(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, init);
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* */
  }
  return { status: res.status, json, text: text.slice(0, 200) };
}

async function main() {
  const tests: Array<{ name: string; pass: boolean; detail: string }> = [];

  const unauthCase = await req('/api/desk/cases/1');
  tests.push({
    name: 'IDOR_UNAUTH_CASE',
    pass: unauthCase.status === 403,
    detail: `status=${unauthCase.status}`,
  });

  const unauthToday = await req('/api/desk/today');
  tests.push({
    name: 'IDOR_UNAUTH_TODAY',
    pass: unauthToday.status === 403,
    detail: `status=${unauthToday.status}`,
  });

  const unauthQualify = await req('/api/desk/cases/1/qualify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ buyerFilters: {} }),
  });
  tests.push({
    name: 'IDOR_UNAUTH_QUALIFY',
    pass: unauthQualify.status === 403,
    detail: `status=${unauthQualify.status}`,
  });

  const unauthReport = await req('/api/desk/offers/221/seller-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  tests.push({
    name: 'IDOR_UNAUTH_SELLER_REPORT',
    pass: unauthReport.status === 403,
    detail: `status=${unauthReport.status}`,
  });

  const unauthMap = await req('/api/desk/map');
  tests.push({
    name: 'IDOR_UNAUTH_MAP',
    pass: unauthMap.status === 403,
    detail: `status=${unauthMap.status}`,
  });

  const crmPage = await req('/crm');
  tests.push({
    name: 'CRM_PAGE_LOAD',
    pass: crmPage.status === 200 || crmPage.status === 307 || crmPage.status === 302,
    detail: `status=${crmPage.status} (redirect to login OK)`,
  });

  const oldCrm = await req('/moje-konto/crm');
  tests.push({
    name: 'OLD_CRM_PAGE',
    pass: oldCrm.status === 200 || oldCrm.status === 307 || oldCrm.status === 302,
    detail: `status=${oldCrm.status}`,
  });

  const mapConfig = await req('/api/map/config');
  tests.push({
    name: 'MAP_CONFIG',
    pass: mapConfig.status === 200,
    detail: `status=${mapConfig.status}`,
  });

  let failed = 0;
  for (const t of tests) {
    if (t.pass) console.log(`✓ ${t.name} — ${t.detail}`);
    else {
      console.error(`✗ ${t.name} — ${t.detail}`);
      failed += 1;
    }
  }
  console.log(`\nHTTP: ${tests.length - failed}/${tests.length}`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

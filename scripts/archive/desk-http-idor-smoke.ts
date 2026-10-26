/**
 * HTTP IDOR smoke with real NextAuth sessions (temp staging agents).
 * Run: SMOKE_BASE=https://estateos.pl npx tsx scripts/desk-http-idor-smoke.ts
 */
const BASE = process.env.SMOKE_BASE || 'https://estateos.pl';
const EMAIL_A = process.env.SMOKE_EMAIL_A || 'desk-smoke-a@staging.test';
const EMAIL_B = process.env.SMOKE_EMAIL_B || 'desk-smoke-b@staging.test';
const PASSWORD = process.env.SMOKE_PASSWORD || 'DeskSmoke2026!Test';

type Result = { name: string; pass: boolean; detail: string };

async function login(email: string): Promise<string> {
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const setCookies = loginRes.headers.getSetCookie?.() ?? [];
  let cookieJar = setCookies.map((c) => c.split(';')[0]).join('; ');
  if (!cookieJar.includes('estateos_session')) {
    const text = await loginRes.text();
    throw new Error(`Login failed for ${email}: status=${loginRes.status} body=${text.slice(0, 120)}`);
  }
  return cookieJar;
}

async function api(
  path: string,
  cookie: string,
  init?: RequestInit,
): Promise<{ status: number; body: string }> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Cookie: cookie,
    },
    cache: 'no-store',
  });
  const text = await res.text();
  return { status: res.status, body: text, preview: text.slice(0, 300) };
}

async function main() {
  const results: Result[] = [];

  let cookieA: string;
  let cookieB: string;
  try {
    cookieA = await login(EMAIL_A);
    results.push({ name: 'LOGIN_A', pass: true, detail: EMAIL_A });
  } catch (e) {
    console.error('LOGIN_A FAIL', e);
    process.exit(1);
  }
  try {
    cookieB = await login(EMAIL_B);
    results.push({ name: 'LOGIN_B', pass: true, detail: EMAIL_B });
  } catch (e) {
    console.error('LOGIN_B FAIL', e);
    process.exit(1);
  }

  // Agent A creates resources via API
  const prospectRes = await api('/api/desk/prospects', cookieA, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Idor Smoke',
      phone: `+4855599${String(Date.now()).slice(-4)}`,
      email: `idor-${Date.now()}@staging.test`,
      source: 'idor_smoke',
    }),
  });
  let caseId = 0;
  try {
    const j = JSON.parse(prospectRes.body) as { case?: { id?: number } };
    caseId = Number(j?.case?.id || 0);
  } catch {
    /* */
  }
  if (!caseId && prospectRes.status === 200) {
    const list = await api('/api/desk/cases?board=prospecting', cookieA);
    try {
      const lj = JSON.parse(list.body) as { cases?: Array<{ id: number }> };
      caseId = lj.cases?.[0]?.id || 0;
    } catch {
      /* */
    }
  }
  results.push({
    name: 'AGENT_A_CREATE_CASE',
    pass: prospectRes.status === 200 && caseId > 0,
    detail: `status=${prospectRes.status} caseId=${caseId}`,
  });

  let offerId = 0;
  const offerList = await fetch(`${BASE}/api/offers`, {
    headers: { Cookie: cookieA },
  }).catch(() => null);
  if (offerList?.ok) {
    const arr = (await offerList.json()) as Array<{ id: number }>;
    offerId = arr[0]?.id || 0;
  }
  if (!offerId) offerId = 221;

  const blocked = (status: number) => status === 403 || status === 404 || status === 400;

  if (caseId) {
    const tests: Array<[string, string, RequestInit?]> = [
      ['B_GET_CASE_A', `/api/desk/cases/${caseId}`],
      ['B_PATCH_CASE_A', `/api/desk/cases/${caseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nextAction: 'hack' }),
      }],
      ['B_QUALIFY_A', `/api/desk/cases/${caseId}/qualify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buyerFilters: {} }),
      }],
    ];
    for (const [name, path, init] of tests) {
      const r = await api(path, cookieB, init);
      results.push({ name, pass: blocked(r.status), detail: `status=${r.status}` });
    }
  }

  if (offerId) {
    for (const [name, path, init] of [
      ['B_INSPECTOR_A', `/api/desk/offers/${offerId}/inspector`],
      ['B_SELLER_REPORT_A', `/api/desk/offers/${offerId}/seller-report`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: 1 }) }],
      ['B_GUESTS_A', `/api/desk/offer-guests?offerId=${offerId}`],
    ] as const) {
      const r = await api(path, cookieB, init);
      results.push({ name, pass: blocked(r.status), detail: `status=${r.status}` });
    }
  }

  const unauth = await api('/api/desk/cases/1', '');
  results.push({ name: 'UNAUTH_BLOCKED', pass: unauth.status === 403, detail: `status=${unauth.status}` });

  let failed = 0;
  for (const r of results) {
    if (r.pass) console.log(`✓ ${r.name} — ${r.detail}`);
    else {
      console.error(`✗ ${r.name} — ${r.detail}`);
      failed += 1;
    }
  }
  console.log(`\nIDOR HTTP: ${results.length - failed}/${results.length}`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

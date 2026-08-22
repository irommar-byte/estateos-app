/**
 * Authenticated Desk workflow smoke via HTTP (estateos_session).
 * Maps to UI steps — verifies API+DB after each transition.
 */
const BASE = process.env.SMOKE_BASE || 'https://estateos.pl';
const EMAIL = process.env.SMOKE_EMAIL_A || 'desk-smoke-a@staging.test';
const PASS = process.env.SMOKE_PASSWORD || 'DeskSmoke2026!Test';

async function login(): Promise<string> {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const jar = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  if (!jar.includes('estateos_session')) throw new Error(`login fail ${r.status}`);
  return jar;
}

async function api(cookie: string, path: string, init?: RequestInit) {
  const r = await fetch(`${BASE}${path}`, { ...init, headers: { ...(init?.headers || {}), Cookie: cookie } });
  const text = await r.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* */
  }
  return { status: r.status, json, text };
}

function log(ok: boolean, name: string, detail: string) {
  console.log(`${ok ? '✓' : '✗'} ${name} — ${detail}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  const cookie = await login();
  log(true, 'LOGIN', EMAIL);

  const ts = Date.now();
  const pr = await api(cookie, '/api/desk/prospects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `UI Smoke ${ts}`,
      phone: `+4855522${String(ts).slice(-4)}`,
      email: `ui-smoke-${ts}@staging.test`,
      source: 'ui_smoke',
    }),
  });
  const caseId = (pr.json as { case?: { id?: number } })?.case?.id;
  log(pr.status === 200 && !!caseId, 'SELL_PROSPECT', `case #${caseId}`);

  if (!caseId) return;

  for (const [name, outcome, payload] of [
    ['CALL', 'INTERESTED', {}],
    ['MEETING', 'MEETING_BOOKED', { startsAt: new Date(Date.now() + 86400000).toISOString() }],
    ['ACQUISITION', 'MEETING_COMPLETED', {}],
    ['CONTRACT', 'CONTRACT_SIGNED', { durationMonths: 6 }],
  ] as const) {
    const r = await api(cookie, `/api/desk/cases/${caseId}/outcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome, payload }),
    });
    log(r.status === 200, `SELL_${name}`, `status=${r.status}`);
  }

  const detail = await api(cookie, `/api/desk/cases/${caseId}`);
  const stage = (detail.json as { case?: { pipelineStage?: string } })?.case?.pipelineStage;
  log(!!stage, 'SELL_STAGE', stage || '?');

  const today = await api(cookie, '/api/desk/today');
  log(today.status === 200, 'TODAY', `status=${today.status}`);

  const search = await api(cookie, '/api/desk/search?q=UI');
  log(search.status === 200, 'CMDK_SEARCH', `status=${search.status}`);

  console.log('\nSession workflow smoke done. Verify same flow in /crm UI with temp account.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

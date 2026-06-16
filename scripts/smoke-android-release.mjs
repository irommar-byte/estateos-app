#!/usr/bin/env node
/**
 * Smoke przed buildem Android: katalog ofert (pineski) + logowanie.
 * Uruchom: node scripts/smoke-android-release.mjs
 */
import {
  buildRadarPinList,
  CATALOG_ENDPOINTS,
  LOGIN_URL,
  normalizeLoginErrorMessage,
  parseOfferList,
} from '../src/utils/offerCatalogPipeline';

const MOBILE_HEADERS = {
  Accept: 'application/json',
  'Cache-Control': 'no-cache',
  'User-Agent': 'EstateOS-Mobile/android-smoke',
};

const MIN_PINS = 10;
const MAX_CATALOG_BYTES = 400_000;

let failed = 0;

function pass(label) {
  console.log(`✅ ${label}`);
}

function fail(label, detail = '') {
  failed += 1;
  console.error(`❌ ${label}${detail ? ` — ${detail}` : ''}`);
}

async function fetchJson(url, init = {}) {
  const res = await fetch(url, { ...init, headers: { ...MOBILE_HEADERS, ...(init.headers || {}) } });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { res, data, bytes: text.length };
}

async function testCatalog() {
  console.log('\n=== Katalog ofert (pineski) ===');
  let best = { url: '', pins: 0, bytes: Infinity };

  for (const url of CATALOG_ENDPOINTS) {
    try {
      const { res, data, bytes } = await fetchJson(url);
      const list = parseOfferList(data);
      const pins = Array.isArray(list) ? buildRadarPinList(list) : [];
      console.log(`  ${url}`);
      console.log(`    HTTP ${res.status}, ${bytes} B, parsed=${list?.length ?? 0}, pins=${pins.length}`);

      if (res.ok && pins.length > best.pins) {
        best = { url, pins: pins.length, bytes };
      }
    } catch (err) {
      fail(`fetch ${url}`, err instanceof Error ? err.message : String(err));
    }
  }

  if (best.pins >= MIN_PINS) {
    pass(`Katalog OK: ${best.pins} pinów z ${best.url} (${best.bytes} B)`);
  } else {
    fail(`Za mało pinów (${best.pins}, wymagane ≥${MIN_PINS})`);
  }

  const catalogUrl = CATALOG_ENDPOINTS[0];
  try {
    const { bytes } = await fetchJson(catalogUrl);
    if (bytes <= MAX_CATALOG_BYTES) {
      pass(`Lekki katalog ?catalog=1: ${bytes} B (limit ${MAX_CATALOG_BYTES} B)`);
    } else {
      fail(`Katalog ?catalog=1 za duży: ${bytes} B > ${MAX_CATALOG_BYTES} B`);
    }
  } catch (err) {
    fail('Pomiar rozmiaru catalog=1', err instanceof Error ? err.message : String(err));
  }

  // Próbka współrzędnych w Warszawie / okolicy
  try {
    const { data } = await fetchJson(catalogUrl);
    const pins = buildRadarPinList(parseOfferList(data) || []);
    const sample = pins.slice(0, 3);
    const inPoland = sample.every((p) => p.lat > 49 && p.lat < 55 && p.lng > 14 && p.lng < 24);
    if (sample.length >= 3 && inPoland) {
      pass(`Współrzędne pinów w sensownym zakresie PL: ${JSON.stringify(sample)}`);
    } else {
      fail('Współrzędne pinów poza oczekiwanym zakresem', JSON.stringify(sample));
    }
  } catch (err) {
    fail('Walidacja współrzędnych', err instanceof Error ? err.message : String(err));
  }
}

async function testLogin() {
  console.log('\n=== Logowanie ===');

  try {
    const { res, data } = await fetchJson(LOGIN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'smoke-test@estateos.pl', password: '__wrong__' }),
    });
    const errMsg = String(data?.error || data?.message || '');
    const normalized = normalizeLoginErrorMessage(errMsg || `HTTP ${res.status}`);

    if (res.status === 401) {
      pass(`Login endpoint odpowiada 401 dla złego hasła`);
    } else {
      fail(`Login endpoint: oczekiwano 401, jest ${res.status}`);
    }

    if (/nieprawidłowy e-mail|nieprawidłowy login|invalid/i.test(normalized)) {
      pass(`Komunikat błędu credentials: "${normalized.slice(0, 60)}…"`);
    } else {
      fail('Komunikat błędu credentials', normalized);
    }
  } catch (err) {
    fail('Login POST', err instanceof Error ? err.message : String(err));
  }

  const smokeEmail = process.env.MOBILE_SMOKE_EMAIL?.trim();
  const smokePass = process.env.MOBILE_SMOKE_PASSWORD?.trim();
  if (smokeEmail && smokePass) {
    try {
      const { res, data } = await fetchJson(LOGIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: smokeEmail, password: smokePass }),
      });
      if (res.ok && data?.token) {
        pass(`Login poprawny dla ${smokeEmail} (token ${String(data.token).slice(0, 12)}…)`);
      } else {
        fail(`Login poprawny dla ${smokeEmail}`, String(data?.error || res.status));
      }
    } catch (err) {
      fail('Login poprawny', err instanceof Error ? err.message : String(err));
    }
  } else {
    console.log('ℹ️  Pominięto test poprawnego logowania (ustaw MOBILE_SMOKE_EMAIL + MOBILE_SMOKE_PASSWORD)');
  }
}

async function testMapsKeyConfigured() {
  console.log('\n=== Google Maps (build env) ===');
  const key =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();
  if (key && key.length > 20) {
    pass(`Klucz Maps w env (${key.slice(0, 8)}…)`);
  } else {
    console.log('ℹ️  Brak klucza Maps lokalnie — EAS production env ładuje EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_API_KEY');
  }
}

async function main() {
  console.log('EstateOS Android release smoke');
  await testCatalog();
  await testLogin();
  await testMapsKeyConfigured();

  console.log('\n=== Podsumowanie ===');
  if (failed === 0) {
    console.log('✅ Wszystkie testy przeszły — można budować Android release.');
    process.exit(0);
  }
  console.error(`❌ ${failed} test(ów) nie przeszło — NIE buduj release.`);
  process.exit(1);
}

main();

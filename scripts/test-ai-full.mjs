/**
 * Pełny test AI: modele OpenAI + opis formularza + import OtoDom (Ursus + Myśliborska).
 * Uruchom: npx tsx scripts/test-ai-full.mjs
 */
import 'dotenv/config';

const OWNER_BAD = [
  /bez\s+po[śs]rednik[óo]w/i,
  /sprzeda[żz]\s+prywatn/i,
  /sprzeda[żz]\s+bezpo[śs]redni/i,
  /\bmamy\s+do\s+sprzedania/i,
  /\bsprzedajemy\b/i,
  /\bja\s+jako\b/i,
  /\bbyłam\b/i,
  /cena\s+za\s+m²/i,
];

const AGENT_GOOD = [/prezentujemy/i, /oferujemy/i, /lokal/i, /mieszkanie/i];

function assert(name, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
    return false;
  }
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  return true;
}

async function testModelAccess() {
  const { default: OpenAI } = await import('openai');
  const key = process.env.OPENAI_API_KEY?.trim()?.replace(/^"|"$/g, '');
  if (!key) return assert('OPENAI_API_KEY', false, 'brak klucza');

  const client = new OpenAI({ apiKey: key });
  const models = ['gpt-5-mini', 'o4-mini', 'gpt-4o-mini'];
  let anyWorking = false;

  for (const model of models) {
    try {
      const r = await client.responses.create({
        model,
        instructions: 'Odpowiedz jednym slowem OK',
        input: 'Test',
        max_output_tokens: 32,
      });
      const text = String(r.output_text || '').trim();
      console.log(`INFO  model ${model}: dostępny (${text.length} znaków)`);
      anyWorking = true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`INFO  model ${model}: niedostępny — ${msg.slice(0, 100)}`);
    }
  }

  return assert('OpenAI — przynajmniej jeden model działa', anyWorking);
}

async function testListingDescription() {
  const { generateListingDescriptionWithGpt } = await import('../src/lib/listingDescriptionAi.ts');
  const result = await generateListingDescriptionWithGpt({
    locale: 'pl',
    title: 'Mieszkanie 3 pokoje Ursus',
    transactionType: 'sale',
    propertyType: 'apartment',
    city: 'Warszawa',
    district: 'Ursus',
    lat: 52.195,
    lng: 20.884,
    price: '650000',
    priceCurrency: 'PLN',
    area: '58',
    rooms: '3',
    floor: '2',
    totalFloors: '4',
    yearBuilt: '2018',
    hasBalcony: true,
  });

  let ok = true;
  ok = assert('Listing — model zwrócony', Boolean(result.model), result.model) && ok;
  ok = assert('Listing — długość >= 400', result.description.length >= 400, `${result.description.length} znaków`) && ok;
  ok = assert('Listing — ton agenta', AGENT_GOOD.some((p) => p.test(result.description))) && ok;
  ok = assert('Listing — brak języka właściciela', !OWNER_BAD.some((p) => p.test(result.description))) && ok;
  ok = assert('Listing — model dozwolony', /gpt-5-mini|o4-mini|gpt-4o-mini/.test(result.model)) && ok;
  return ok;
}

async function testImportUrsus() {
  const { buildOtodomPresentationCopy } = await import('../src/lib/otodomImportRewrite.ts');
  const draft = {
    title: 'Mieszkanie 4 pokoje Ursus',
    city: 'Warszawa',
    district: 'Ursus',
    transactionType: 'SALE',
    propertyType: 'APARTMENT',
    price: 795000,
    area: 62.2,
    rooms: 4,
    floor: 2,
    totalFloors: 5,
    features: ['balkon', 'piwnica'],
    descriptionText: `Bez pośredników, sprzedaż prywatna.
Sprzedajemy 62,2 m² gotowe do zamieszkania.
Mamy do sprzedania mieszkanie z 4 pokojami i balkonem.
Zapraszamy do obejrzenia i negocjacji ceny.`,
    descriptionHtml: '',
    imageUrls: [],
    externalId: 'test-ursus',
    portalUrl: 'https://otodom.pl/test-ursus',
  };

  const result = await buildOtodomPresentationCopy(draft, { agentVoice: true, forceAi: true });
  const plain = result.descriptionPreview || '';

  let ok = true;
  ok = assert('Import Ursus — AI przepisał', result.rewrittenByAi === true, result.aiSkipReason || '') && ok;
  ok = assert('Import Ursus — długość >= 350', plain.length >= 350, `${plain.length} znaków`) && ok;
  ok = assert('Import Ursus — brak języka właściciela', !OWNER_BAD.some((p) => p.test(plain))) && ok;
  ok = assert('Import Ursus — HTML ma sekcje', (result.descriptionHtml.match(/<p\b/gi) || []).length >= 2) && ok;
  return ok;
}

async function testImportMysliborska() {
  const { buildOtodomPresentationCopy } = await import('../src/lib/otodomImportRewrite.ts');
  const draft = {
    title: 'Mieszkanie na sprzedaż',
    city: 'Warszawa',
    district: 'Tarchomin',
    transactionType: 'SALE',
    propertyType: 'APARTMENT',
    price: 599500,
    area: 45.7,
    rooms: 1,
    floor: 2,
    totalFloors: 3,
    yearBuilt: 2003,
    features: ['balkon'],
    descriptionText: `Na sprzedaż komfortowe mieszkanie jednopokojowe o powierzchni 45,7 m2, położone przy ul. Myśliborskiej.
W skład mieszkania wchodzi pokój dzienny z balkonem - 26,5 m2, kuchnia - 8 m2.
Sprzedaż bezpośrednia.`,
    descriptionHtml: '',
    imageUrls: [],
    externalId: 'test-mysliborska',
    portalUrl: 'https://otodom.pl/test-mysliborska',
  };

  const result = await buildOtodomPresentationCopy(draft, { agentVoice: true, forceAi: true });
  const plain = result.descriptionPreview || '';

  let ok = true;
  ok = assert('Import Myśliborska — AI przepisał', result.rewrittenByAi === true, result.aiSkipReason || '') && ok;
  ok = assert('Import Myśliborska — długość >= 350', plain.length >= 350, `${plain.length} znaków`) && ok;
  ok = assert('Import Myśliborska — brak „sprzedaż bezpośrednia”', !/sprzeda[żz]\s+bezpo[śs]redni/i.test(plain)) && ok;
  return ok;
}

async function testApiHealth() {
  const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
  try {
    const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(8000) });
    const ok = res.ok;
    return assert('API /api/health', ok, `status ${res.status}`);
  } catch (e) {
    return assert('API /api/health', false, e instanceof Error ? e.message : String(e));
  }
}

console.log('=== EstateOS AI — pełny test ===\n');

const results = [];
results.push(await testModelAccess());
results.push(await testListingDescription());
results.push(await testImportUrsus());
results.push(await testImportMysliborska());
results.push(await testApiHealth());

const passed = results.filter(Boolean).length;
const total = results.length;

console.log(`\n=== Wynik: ${passed}/${total} ===`);
if (passed !== total) process.exit(1);
console.log('Wszystko OK');

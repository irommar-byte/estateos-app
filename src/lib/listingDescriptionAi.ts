import { fetchMapboxReverseFeature } from '@/lib/location/resolveOfferLocationFromCoordinates';

export type ListingDescriptionDraftInput = {
  locale?: string;
  title?: string;
  transactionType?: string;
  propertyType?: string;
  condition?: string | null;
  city?: string;
  district?: string;
  localityCountry?: string;
  street?: string;
  buildingNumber?: string;
  lat?: number | null;
  lng?: number | null;
  isExactLocation?: boolean;
  priceCurrency?: string;
  price?: string;
  adminFee?: string;
  deposit?: string;
  area?: string;
  plotArea?: string;
  rooms?: string;
  floor?: string;
  totalFloors?: string;
  yearBuilt?: string;
  heating?: string;
  hasBalcony?: boolean;
  hasElevator?: boolean;
  hasStorage?: boolean;
  hasParking?: boolean;
  hasGarden?: boolean;
  isTwoLevel?: boolean;
  isFurnished?: boolean;
  agentCommissionPercent?: string;
};

type NeighborhoodContext = {
  reverseLabel?: string;
  nearbyPlaces: string[];
  note?: string;
};

const POI_SEARCH_TERMS = [
  'przystanek autobusowy',
  'sklep spożywczy',
  'szkoła',
  'przedszkole',
  'park',
  'apteka',
  'stacja metra',
  'dworzec kolejowy',
];

function getMapboxToken(): string {
  return String(process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '').trim();
}

function parseNum(raw: unknown): number | null {
  const n = Number(String(raw ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function truthy(v: unknown): boolean {
  return v === true || v === 1 || v === 'true' || v === '1';
}

function resolveLocale(raw: unknown): 'pl' | 'en' | 'ru' {
  const code = String(raw || 'pl').trim().toLowerCase();
  if (code.startsWith('en')) return 'en';
  if (code.startsWith('ru') || code.startsWith('uk')) return 'ru';
  return 'pl';
}

async function fetchNearbyPois(lat: number, lng: number, token: string): Promise<string[]> {
  const proximity = `${lng},${lat}`;
  const found: string[] = [];

  await Promise.all(
    POI_SEARCH_TERMS.map(async (term) => {
      try {
        const params = new URLSearchParams({
          access_token: token,
          language: 'pl',
          limit: '2',
          types: 'poi',
          proximity,
        });
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(term)}.json?${params}`;
        const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(4500) });
        if (!res.ok) return;
        const payload = await res.json();
        const features = Array.isArray(payload?.features) ? payload.features : [];
        for (const feature of features) {
          const name = String(feature?.text_pl || feature?.text || '').trim();
          if (!name) continue;
          const label = `${term}: ${name}`;
          if (!found.includes(label)) found.push(label);
        }
      } catch {
        /* ignore single POI failure */
      }
    }),
  );

  return found.slice(0, 12);
}

export async function buildNeighborhoodContext(
  draft: ListingDescriptionDraftInput,
): Promise<NeighborhoodContext> {
  const lat = parseNum(draft.lat);
  const lng = parseNum(draft.lng);
  const token = getMapboxToken();

  if (!lat || !lng || !token) {
    const city = String(draft.city || '').trim();
    const district = String(draft.district || '').trim();
    return {
      nearbyPlaces: [],
      note:
        city || district
          ? `Lokalizacja z formularza: ${[city, district].filter(Boolean).join(', ')} (bez współrzędnych pinezki — opis okolicy ogólny).`
          : 'Brak pinezki na mapie — opisz okolicę ogólnie, bez konkretnych odległości.',
    };
  }

  const feature = await fetchMapboxReverseFeature(lat, lng);
  const reverseLabel = String(feature?.place_name_pl || feature?.place_name || '').trim() || undefined;
  const nearbyPlaces = await fetchNearbyPois(lat, lng, token);

  return {
    reverseLabel,
    nearbyPlaces,
    note:
      nearbyPlaces.length > 0
        ? 'Punkty POI pochodzą z geokodowania w promieniu ok. 1 km od pinezki — używaj ich jako inspiracji, nie podawaj metrów jeśli ich nie znasz.'
        : 'Brak szczegółowych POI z mapy — opisz styl okolicy ogólnie na podstawie miasta/dzielnicy.',
  };
}

function buildDraftFacts(draft: ListingDescriptionDraftInput): Record<string, unknown> {
  const amenities: string[] = [];
  if (truthy(draft.hasBalcony)) amenities.push('balkon');
  if (truthy(draft.hasParking)) amenities.push('parking/garaż');
  if (truthy(draft.hasStorage)) amenities.push('piwnica/komórka');
  if (truthy(draft.hasElevator)) amenities.push('winda');
  if (truthy(draft.hasGarden)) amenities.push('ogród');
  if (truthy(draft.isTwoLevel)) amenities.push('dwupoziomowe');
  if (truthy(draft.isFurnished)) amenities.push('umeblowane');

  const city = String(draft.city || '').trim();
  const district = String(draft.district || '').trim();
  const street = String(draft.street || '').trim();
  const building = String(draft.buildingNumber || '').trim();

  return {
    title: String(draft.title || '').trim() || null,
    transactionType: draft.transactionType || null,
    propertyType: draft.propertyType || null,
    condition: draft.condition || null,
    location: {
      city: city || null,
      district: district || null,
      country: String(draft.localityCountry || '').trim() || null,
      street: draft.isExactLocation === false ? null : street || null,
      buildingNumber: draft.isExactLocation === false ? null : building || null,
      coordinates: draft.lat && draft.lng ? { lat: draft.lat, lng: draft.lng } : null,
      locationPrecision: draft.isExactLocation === false ? 'approximate_circle' : 'exact_pin',
    },
    price: parseNum(draft.price),
    priceCurrency: String(draft.priceCurrency || 'PLN').trim(),
    adminFee: parseNum(draft.adminFee),
    deposit: parseNum(draft.deposit),
    areaSqm: parseNum(draft.area),
    plotAreaSqm: parseNum(draft.plotArea),
    rooms: parseNum(draft.rooms),
    floor: String(draft.floor ?? '').trim() || null,
    totalFloors: String(draft.totalFloors ?? '').trim() || null,
    yearBuilt: String(draft.yearBuilt ?? '').trim() || null,
    heating: String(draft.heating ?? '').trim() || null,
    amenities,
    agentCommissionPercent: String(draft.agentCommissionPercent ?? '').trim() || null,
  };
}

function localeInstructions(locale: 'pl' | 'en' | 'ru'): string {
  if (locale === 'en') {
    return `Write the entire description in English.
Tone: professional real-estate agency ("We present…"), warm and credible.
Do NOT output HTML — plain text with paragraphs separated by blank lines.`;
  }
  if (locale === 'ru') {
    return `Napisz cały opis po rosyjsku.
Ton: profesjonalne biuro nieruchomości, ciepły i wiarygodny.
Bez HTML — zwykły tekst z akapitami oddzielonymi pustą linią.`;
  }
  return `Napisz cały opis po polsku.
Ton: profesjonalne biuro nieruchomości ("Prezentujemy Państwu…"), ciepły i wiarygodny — NIE język właściciela ("sprzedajemy", "mamy do sprzedania", "bez pośredników").
Bez HTML — zwykły tekst z akapitami oddzielonymi pustą linią.`;
}

function buildSystemPrompt(locale: 'pl' | 'en' | 'ru'): string {
  return `Jesteś copywriterem premium w EstateOS™ — tworzysz opisy nieruchomości na portal.

${localeInstructions(locale)}

ZASADY:
- Opis ma być narracją marketingową: styl życia, atmosfera, układ, okolica — NIE sucha lista parametrów.
- Parametry z JSON możesz wpleść naturalnie (1–2 zdania), ale główna treść to opis doświadczenia mieszkania i okolicy.
- Wykorzystaj kontekst okolicy (POI, reverse geocode) — komunikacja, sklepy, zieleń, infrastruktura rodzinna.
- Nie wymyślaj konkretnych metrów/minut dojścia, chyba że wynikają wprost z POI (wtedy ostrożnie: "w pobliżu", "w zasięgu spaceru").
- Nie podawaj dokładnego adresu ulicy, gdy locationPrecision = approximate_circle.
- Nie powtarzaj tytułu oferty w pierwszym zdaniu dosłownie.
- Długość: ok. 900–1600 znaków (4–7 akapitów).
- Bez emoji, bez nagłówków CAPS, bez list punktowanych parametrów.
- Zakończ krótkim zaproszeniem do kontaktu/prezentacji.`;
}

function buildUserPrompt(
  facts: Record<string, unknown>,
  neighborhood: NeighborhoodContext,
  locale: 'pl' | 'en' | 'ru',
): string {
  return `Wygeneruj opis oferty na podstawie danych:

PARAMETRY OFERTY (JSON):
${JSON.stringify(facts, null, 2)}

KONTEKST OKOLICY (pinezka / mapa):
${JSON.stringify(neighborhood, null, 2)}

Język wyjściowy: ${locale}.`;
}

function stripAiDescription(raw: string): string {
  let text = String(raw || '').trim();
  text = text.replace(/^```(?:markdown|text)?\s*/i, '').replace(/\s*```$/i, '').trim();
  text = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  return text.slice(0, 7800);
}

function openAiErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/429|rate limit/i.test(msg)) return 'Limit zapytań OpenAI — spróbuj za chwilę.';
  if (/does not have access to model/i.test(msg)) {
    return 'Ten klucz OpenAI nie ma dostępu do wybranego modelu — skontaktuj się z administratorem.';
  }
  if (/401|invalid.*key|incorrect api key/i.test(msg)) return 'Błąd konfiguracji OpenAI na serwerze.';
  if (/quota|insufficient/i.test(msg)) return 'Przekroczony limit konta OpenAI.';
  return `OpenAI: ${msg.slice(0, 140)}`;
}

function resolveListingModel(): string {
  return (
    process.env.OPENAI_LISTING_MODEL?.trim() ||
    process.env.OPENAI_OTODOM_MODEL?.trim() ||
    'gpt-5.5-pro'
  );
}

/** GPT-5.x na tym koncie działa wyłącznie przez Responses API (nie chat/completions). */
function usesResponsesApi(model: string): boolean {
  return /^gpt-5|^o[0-9]/i.test(model.trim());
}

async function generateWithOpenAi(params: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
}): Promise<string> {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: params.apiKey });

  if (usesResponsesApi(params.model)) {
    const response = await client.responses.create({
      model: params.model,
      instructions: params.system,
      input: params.user,
      max_output_tokens: 1800,
    });
    const text = String(response.output_text || '').trim();
    if (!text) throw new Error('OpenAI Responses API zwróciło pusty wynik.');
    return text;
  }

  const completion = await client.chat.completions.create({
    model: params.model,
    temperature: 0.72,
    max_tokens: 1400,
    messages: [
      { role: 'system', content: params.system },
      { role: 'user', content: params.user },
    ],
  });
  return String(completion.choices[0]?.message?.content || '').trim();
}

export async function generateListingDescriptionWithGpt(
  draft: ListingDescriptionDraftInput,
): Promise<{ description: string; model: string }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()?.replace(/^"|"$/g, '');
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY niedostępny na serwerze.');
  }

  const locale = resolveLocale(draft.locale);
  const facts = buildDraftFacts(draft);
  const neighborhood = await buildNeighborhoodContext(draft);
  const model = resolveListingModel();
  const system = buildSystemPrompt(locale);
  const user = buildUserPrompt(facts, neighborhood, locale);

  const content = await generateWithOpenAi({ apiKey, model, system, user });
  if (!content || content.length < 120) {
    throw new Error('OpenAI zwróciło zbyt krótki opis.');
  }

  return { description: stripAiDescription(content), model };
}

export { openAiErrorMessage };

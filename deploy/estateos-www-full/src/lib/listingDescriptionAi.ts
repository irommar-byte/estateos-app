import { fetchMapboxReverseFeature } from '@/lib/location/resolveOfferLocationFromCoordinates';
import { extractListingRoomAreas, formatListingAreaSqm } from '@/lib/listingRoomAreas';
import { callOpenAiText, getOpenAiApiKey, openAiErrorMessage, resolveOpenAiModel } from '@/lib/openAiClient';

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
  area?: string;
  existingDescription?: string;
  userNotes?: string;
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
  propertyRoomScans?: unknown;
  roomScans?: unknown;
  roomAreas?: unknown;
  roomsBreakdown?: unknown;
  floorPlanScanMeta?: unknown;
  scanMeta?: unknown;
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
    areaSqm: parseNum(draft.area),
    plotAreaSqm: parseNum(draft.plotArea),
    rooms: parseNum(draft.rooms),
    floor: String(draft.floor ?? '').trim() || null,
    totalFloors: String(draft.totalFloors ?? '').trim() || null,
    yearBuilt: String(draft.yearBuilt ?? '').trim() || null,
    heating: String(draft.heating ?? '').trim() || null,
    amenities,
    roomAreas: extractListingRoomAreas(draft).map((room) => ({
      name: room.name,
      area: `${formatListingAreaSqm(room.areaSqm)} m²`,
    })),
    existingDescription: String(draft.existingDescription || '').trim() || null,
    userNotes: String(draft.userNotes || '').trim() || null,
  };
}

function localeInstructions(locale: 'pl' | 'en' | 'ru'): string {
  if (locale === 'en') {
    return `Write the entire description in English.
Tone: professional real-estate agency ("We present…"), warm and credible.
Do NOT output HTML. Use the editorial plain-text format described below.`;
  }
  if (locale === 'ru') {
    return `Napisz cały opis po rosyjsku.
Ton: profesjonalne biuro nieruchomości, ciepły i wiarygodny.
Bez HTML — użyj formatu redakcyjnego opisanego poniżej.`;
  }
  return `Napisz cały opis po polsku.
Ton: profesjonalne biuro nieruchomości ("Prezentujemy Państwu…"), ciepły i wiarygodny — NIE język właściciela ("sprzedajemy", "mamy do sprzedania", "bez pośredników").
Bez HTML — użyj formatu redakcyjnego opisanego poniżej.`;
}

function buildSystemPrompt(locale: 'pl' | 'en' | 'ru'): string {
  return `Jesteś copywriterem premium w EstateOS™ — tworzysz opisy nieruchomości na portal.

${localeInstructions(locale)}

FORMAT REDAKCYJNY (zwykły tekst):
- Obowiązkowa struktura sekcji (każda sekcja = nagłówek w osobnej linii, potem treść):
  1) Akapit wprowadzający (2–3 zdania lifestyle, bez nagłówka)
  2) Nagłówek: Atuty lokalu → lista z "• " (3–6 punktów)
  3) Jeśli JSON.roomAreas nie jest puste — Nagłówek: Układ pomieszczeń
     najpierw 1 zdanie narracyjne (np. przestronny salon z aneksem), potem lista:
     • Salon z aneksem kuchennym — 18,5 m²
  4) (opcjonalnie) linia "——————"
  5) Nagłówek: Okolica i komunikacja → lista z "• " lub krótki akapit + 2–3 punkty
  6) (opcjonalnie) Nagłówek: Dla kogo → 2–3 punkty z "✓ " dla potwierdzonych cech
  7) Krótkie zaproszenie do kontaktu (1–2 zdania)
- Akapity oddzielone pustą linią.
- Nagłówki sekcji: krótkie, Title Case (np. Atuty lokalu, Okolica i komunikacja) — bez CAPS lock.
- Lista atutów: każda linia zaczyna się od "• ".
- Potwierdzone udogodnienia: linia zaczyna się od "✓ ".
- Elegancki podział sekcji: linia z samych "—" (sześć znaków).
- Wyróżnienie frazy: **pogrubienie** (maks. 4–6 na cały opis).
- Podkreślenie rzadko: __tekst__.
- 1–2 subtelne emotikony w całym opisie (🌿 ✨ 🏡 📍), osadzone naturalnie w zdaniu — nie na początku każdego akapitu.

ZASADY:
- Opis ma być narracją marketingową: styl życia, atmosfera, układ, okolica — NIE sucha lista parametrów.
- Parametry z JSON możesz wpleść naturalnie (1–2 zdania), a konkretne atuty zebrać w listę z "• " lub "✓ ".
- Wykorzystaj kontekst okolicy (POI, reverse geocode) — komunikacja, sklepy, zieleń, infrastruktura rodzinna.
- Nie wymyślaj konkretnych metrów/minut dojścia, chyba że wynikają wprost z POI (wtedy ostrożnie: "w pobliżu", "w zasięgu spaceru").
- Nie podawaj dokładnego adresu ulicy, gdy locationPrecision = approximate_circle.
- Nie powtarzaj tytułu oferty w pierwszym zdaniu dosłownie.
- Długość: ok. 900–1700 znaków (gdy jest Układ pomieszczeń — do 1900).
- roomAreas: jeśli tablica ma elementy, MUSISZ wypisać każde pomieszczenie z dokładnie tą nazwą i metrażem (np. 18,5 m²). Nie zgaduj, nie zaokrąglaj inaczej, nie pomijaj. Nie wymyślaj pomieszczeń, których nie ma w JSON.
- Jeśli roomAreas jest puste — nie podawaj metraży poszczególnych pokoi.
- Jeśli podano existingDescription lub userNotes — wykorzystaj je jako bazę (przepisz / rozwiń / ujednolić styl). Nie ignoruj faktów z notatek.
- NIGDY nie podawaj ceny oferty (ceny sprzedaży / czynszu głównego), kaucji ani prowizji w zł/€ — cena główna jest poza opisem.
- WYJĄTEK: jeśli w userNotes sprzedawca podał ceny przyległości (garaż, komórka, parking, dodatkowe pomieszczenie, opłaty za media poza czynszem) — możesz je naturalnie zawrzeć.
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

export async function generateListingDescriptionWithGpt(
  draft: ListingDescriptionDraftInput,
): Promise<{ description: string; model: string }> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY niedostępny na serwerze.');
  }

  const locale = resolveLocale(draft.locale);
  const facts = buildDraftFacts(draft);
  const neighborhood = await buildNeighborhoodContext(draft);
  const model = resolveOpenAiModel('OPENAI_LISTING_MODEL');
  const system = buildSystemPrompt(locale);
  const user = buildUserPrompt(facts, neighborhood, locale);
  const hasRoomAreas = Array.isArray(facts.roomAreas) && (facts.roomAreas as unknown[]).length > 0;

  const { text, model: usedModel } = await callOpenAiText({
    apiKey,
    model,
    system,
    user,
    maxOutputTokens: hasRoomAreas ? 1600 : 1200,
    logPrefix: 'listing-description-ai',
  });
  if (!text || text.length < 120) {
    throw new Error('OpenAI zwróciło zbyt krótki opis.');
  }

  return { description: stripAiDescription(text), model: usedModel };
}

export { openAiErrorMessage };

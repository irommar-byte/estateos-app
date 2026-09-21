import { fetchMapboxReverseFeature } from '@/lib/location/resolveOfferLocationFromCoordinates';
import { extractListingRoomAreas, formatListingAreaSqm } from '@/lib/listingRoomAreas';
import {
  DESCRIPTION_MAX_CHARS,
  fitDescriptionToTarget,
  maxTokensForLength,
  needsDescriptionExpand,
  resolveTargetLength,
  resolveUseEmojis,
  stripEmojiCharacters,
} from '@/lib/listingDescriptionLength';
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
  targetLength?: number;
  useEmojis?: boolean;
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
  'park',
];

const NOTES_MAX_CHARS = 1500;

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

function compactValue(value: unknown): unknown {
  if (value == null) return undefined;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (Array.isArray(value)) {
    const items = value.map(compactValue).filter((item) => item !== undefined);
    return items.length ? items : undefined;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const compacted = compactValue(item);
      if (compacted !== undefined) out[key] = compacted;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return value;
}

function compactJson(value: Record<string, unknown>): Record<string, unknown> {
  return (compactValue(value) as Record<string, unknown>) || {};
}

function sellerNotes(raw: unknown): string {
  return String(raw || '').trim().slice(0, NOTES_MAX_CHARS);
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
          limit: '1',
          types: 'poi',
          proximity,
        });
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(term)}.json?${params}`;
        const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(4500) });
        if (!res.ok) return;
        const payload = await res.json();
        const features = Array.isArray(payload?.features) ? payload.features : [];
        const name = String(features[0]?.text_pl || features[0]?.text || '').trim();
        if (!name) return;
        const label = `${term}: ${name}`;
        if (!found.includes(label)) found.push(label);
      } catch {
        /* ignore single POI failure */
      }
    }),
  );

  return found.slice(0, 4);
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
  const exact = draft.isExactLocation !== false;

  return compactJson({
    title: String(draft.title || '').trim() || null,
    transactionType: draft.transactionType || null,
    propertyType: draft.propertyType || null,
    condition: draft.condition || null,
    location: {
      city: city || null,
      district: district || null,
      country: String(draft.localityCountry || '').trim() || null,
      street: exact ? street || null : null,
      buildingNumber: exact ? building || null : null,
      locationPrecision: exact ? 'exact_pin' : 'approximate_circle',
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
  });
}

function formatNeighborhood(neighborhood: NeighborhoodContext): string {
  const lines: string[] = [];
  if (neighborhood.reverseLabel) lines.push(neighborhood.reverseLabel);
  for (const place of neighborhood.nearbyPlaces) lines.push(`• ${place}`);
  if (neighborhood.note) lines.push(neighborhood.note);
  return lines.join('\n') || 'Brak szczegółów okolicy.';
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

function buildSystemPrompt(
  locale: 'pl' | 'en' | 'ru',
  options: { hasNotes: boolean; targetLength: number; useEmojis: boolean },
): string {
  const min = options.targetLength - 50;
  const max = options.targetLength + 50;
  const lengthRule = `- CEL DŁUGOŚCI: ${options.targetLength} znaków (dopuszczalnie ${min}…${max}). Nie krócej, nie dłużej.
- Bez wody. Dłuższy budżet = więcej faktów o okolicy, układzie, komunikacji i „dla kogo”, nie ozdobniki ani powtórzenia.`;
  const emojiRule = options.useEmojis
    ? '- Emotikony: użyj 4–10 trafnych emoji (🌿 ✨ 🏡 📍 🚇 🏫) jako znaczników nagłówków i kluczowych atutów, żeby opis był nowocześniejszy i łatwiejszy do skanowania. Nie na początku każdego zdania.'
    : '- ZAKAZ emoji i emotikon. Zero piktogramów.';
  const notesRule = options.hasNotes
    ? `- Masz blok INSTRUKCJE I FAKTY OD SPRZEDAWCY. Jest nadrzędny dla treści (fakty, akcenty). Długość steruje wyłącznie CEL DŁUGOŚCI powyżej, nie notatki.
- Format sekcji zostaje, chyba że sprzedawca każe inaczej.
- Ceny przyległości z notatek (garaż, komórka, parking, media) możesz podać.`
    : '- Nie ma notatek sprzedawcy — zbuduj opis wyłącznie z parametrów oferty i okolicy.';

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
${emojiRule}

ZASADY:
- To jest NOWY opis z parametrów oferty. NIE przepisuj, NIE poprawiaj i NIE streszczaj tekstu z edytora ogłoszenia.
- Opis ma być narracją marketingową: styl życia, atmosfera, układ, okolica — NIE sucha lista parametrów.
- Parametry z JSON możesz wpleść naturalnie (1–2 zdania), a konkretne atuty zebrać w listę z "• " lub "✓ ".
- Wykorzystaj kontekst okolicy (POI, reverse geocode) — komunikacja, sklepy, zieleń, infrastruktura rodzinna.
- Nie wymyślaj konkretnych metrów/minut dojścia, chyba że wynikają wprost z POI (wtedy ostrożnie: "w pobliżu", "w zasięgu spaceru").
- Nie podawaj dokładnego adresu ulicy, gdy locationPrecision = approximate_circle.
- Nie powtarzaj tytułu oferty w pierwszym zdaniu dosłownie.
${lengthRule}
- roomAreas: jeśli tablica ma elementy, MUSISZ wypisać każde pomieszczenie z dokładnie tą nazwą i metrażem (np. 18,5 m²). Nie zgaduj, nie zaokrąglaj inaczej, nie pomijaj. Nie wymyślaj pomieszczeń, których nie ma w JSON.
- Jeśli roomAreas jest puste — nie podawaj metraży poszczególnych pokoi.
${notesRule}
- NIGDY nie podawaj ceny oferty (ceny sprzedaży / czynszu głównego), kaucji ani prowizji w zł/€ — cena główna jest poza opisem.
- Zakończ krótkim zaproszeniem do kontaktu/prezentacji.`;
}

function buildUserPrompt(
  facts: Record<string, unknown>,
  neighborhood: NeighborhoodContext,
  locale: 'pl' | 'en' | 'ru',
  notes: string,
): string {
  const notesBlock = notes
    ? `\nINSTRUKCJE I FAKTY OD SPRZEDAWCY (nadrzędne — zastosuj w całości):\n${notes}\n`
    : '';

  return `Wygeneruj NOWY opis oferty na podstawie danych (nie przepisuj starego tekstu ogłoszenia).

PARAMETRY OFERTY (JSON):
${JSON.stringify(facts)}

OKOLICA:
${formatNeighborhood(neighborhood)}
${notesBlock}
Język wyjściowy: ${locale}.`;
}

function stripAiDescription(raw: string): string {
  let text = String(raw || '').trim();
  text = text.replace(/^```(?:markdown|text)?\s*/i, '').replace(/\s*```$/i, '').trim();
  text = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  return text;
}

async function expandDescriptionOnce(params: {
  apiKey: string;
  model: string;
  current: string;
  targetLength: number;
  neighborhood: NeighborhoodContext;
  locale: 'pl' | 'en' | 'ru';
  useEmojis: boolean;
}): Promise<string | null> {
  const missing = params.targetLength - params.current.length;
  if (missing <= 50) return null;
  try {
    const { text } = await callOpenAiText({
      apiKey: params.apiKey,
      model: params.model,
      skipReasoningFallback: true,
      logPrefix: 'listing-description-ai-expand',
      maxOutputTokens: maxTokensForLength(Math.min(1200, missing + 200)),
      system: `Dopisz brakujące fakty do opisu nieruchomości. Zwróć CAŁY opis (stary tekst + uzupełnienie), nie sam dopisek.
Cel: ${params.targetLength} znaków (±50). Dodaj tylko fakty okolicy, układu lub komunikacji, których brakuje. Bez wody, bez powtórzeń.
${params.useEmojis ? 'Zachowaj oszczędne emoji przy nagłówkach.' : 'Bez emoji.'}
Język: ${params.locale}.`,
      user: `DOTYCHCZASOWY OPIS:\n${params.current}\n\nOKOLICA:\n${formatNeighborhood(params.neighborhood)}\n\nZwróć pełny, dociągnięty opis.`,
    });
    const next = stripAiDescription(text);
    return next.length > params.current.length ? next : null;
  } catch {
    return null;
  }
}

export async function generateListingDescriptionWithGpt(
  draft: ListingDescriptionDraftInput,
): Promise<{ description: string; model: string }> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY niedostępny na serwerze.');
  }

  const locale = resolveLocale(draft.locale);
  const notes = sellerNotes(draft.userNotes);
  const targetLength = resolveTargetLength(draft.targetLength);
  const useEmojis = resolveUseEmojis(draft.useEmojis);
  const facts = buildDraftFacts(draft);
  const neighborhood = await buildNeighborhoodContext(draft);
  const model = resolveOpenAiModel('OPENAI_LISTING_MODEL');
  const system = buildSystemPrompt(locale, { hasNotes: Boolean(notes), targetLength, useEmojis });
  const user = buildUserPrompt(facts, neighborhood, locale, notes);

  const { text, model: usedModel } = await callOpenAiText({
    apiKey,
    model,
    system,
    user,
    maxOutputTokens: maxTokensForLength(targetLength),
    skipReasoningFallback: true,
    logPrefix: 'listing-description-ai',
  });
  if (!text || text.length < 80) {
    throw new Error('OpenAI zwróciło zbyt krótki opis.');
  }

  let description = fitDescriptionToTarget(stripAiDescription(text), targetLength);
  if (needsDescriptionExpand(description, targetLength)) {
    const expanded = await expandDescriptionOnce({
      apiKey,
      model: usedModel,
      current: description,
      targetLength,
      neighborhood,
      locale,
      useEmojis,
    });
    if (expanded) description = fitDescriptionToTarget(expanded, targetLength);
  }
  if (!useEmojis) description = stripEmojiCharacters(description);
  return { description: description.slice(0, DESCRIPTION_MAX_CHARS), model: usedModel };
}

export { openAiErrorMessage };

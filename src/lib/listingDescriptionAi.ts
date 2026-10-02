import { fetchMapboxReverseFeature } from '@/lib/location/resolveOfferLocationFromCoordinates';
import { extractListingRoomAreas, formatListingAreaSqm } from '@/lib/listingRoomAreas';
import {
  DESCRIPTION_MAX_CHARS,
  fitDescriptionToTarget,
  maxTokensForLength,
  needsDescriptionExpand,
  resolveGenerateTitle,
  resolveTargetLength,
  resolveUseEmojis,
  stripEmojiCharacters,
} from '@/lib/listingDescriptionLength';
import {
  callOpenAiText,
  getOpenAiApiKey,
  OPENAI_MODEL_LEGACY,
  openAiErrorMessage,
} from '@/lib/openAiClient';

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
  /** Gdy true — w tej samej odpowiedzi zwróć też atrakcyjny tytuł. */
  generateTitle?: boolean;
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
const EXISTING_DESCRIPTION_MAX = 2200;
const TITLE_MAX_CHARS = 90;

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
  // Nazwa (suterena / komórka / piwnica) — wyłącznie z notatek sprzedawcy, nie zgaduj.
  if (truthy(draft.hasStorage)) amenities.push('pomieszczenie dodatkowe (nazwa wg notatek sprzedawcy)');
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
  options: {
    hasNotes: boolean;
    hasExisting: boolean;
    targetLength: number;
    useEmojis: boolean;
    generateTitle: boolean;
  },
): string {
  const min = options.targetLength - 150;
  const max = options.targetLength + 150;
  const lengthRule = `- CEL DŁUGOŚCI: OBOWIĄZKOWO ok. ${options.targetLength} znaków (minimum ${min}, maksimum ${max}).
- NIE kończ poniżej ${min} znaków. Jeśli brakuje treści — rozwiń: okolica, układ, komunikacja, „dla kogo”, atuty z notatek (bez lania wody i bez powtórzeń).
- Domknij każde zdanie i każdy punkt listy. Nie urywaj w połowie.`;
  const emojiRule = options.useEmojis
    ? '- Emotikony: użyj 4–10 trafnych emoji (🌿 ✨ 🏡 📍 🚇 🏫) przy nagłówkach i kluczowych atutach. Nie na początku każdego zdania.'
    : '- ZAKAZ emoji i emotikon. Zero piktogramów.';

  const rewriteBlock = options.hasNotes
    ? `TRYB PEŁNEJ REDAKCJI (notatki sprzedawcy są OBOWIĄZKOWE):
- Napisz CAŁY opis OD NOWA jako profesjonalny tekst agencji. NIE kosmetyczna poprawka (nie „dodaj parę słów” do starego tekstu).
- OBECNY OPIS (jeśli jest) = tylko źródło faktów do przemapowania; wynik ma brzmieć jak nowa redakcja pod kątem notatek.
- Zastosuj KAŻDĄ instrukcję z notatek (nazewnictwo, akcenty, metraże, potencjał użytkowy, urgency). ZASTĄP sprzeczne sformułowania w całym tekście.
- Przykład: notatki „mieszkanie + suterena 9 m², dziś magazyn, może gabinet/biuro” → w całym opisie podkreśl **mieszkanie wraz z sutereną (~9 m²)**, potencjał (gabinet/biuro/działalność), nie „komórka/schowek” jako główny przekaz.
- Nazwy z JSON NIE mogą nadpisać nazwy z notatek.
- Wolno oddać urgency z notatek BEZ kwoty w zł/€.
- Format sekcji zostaje, chyba że sprzedawca każe inaczej.
- Ceny przyległości z notatek możesz podać, jeśli sprzedawca je podał.`
    : `TRYB NOWY (bez notatek):
- Zbuduj NOWY opis wyłącznie z parametrów oferty i okolicy.
- Nie wymyślaj sutereny/komórki poza tym, co wynika z amenities + rozsądnej ogólności.`;

  const titleRule = options.generateTitle
    ? `- Zwróć JSON: {"description":"...","title":"..."}.
- title: NOWY, atrakcyjny tytuł (1 linia, max ${TITLE_MAX_CHARS} znaków) po analizie całego ogłoszenia i notatek — NIE lekka poprawka starego tytułu. Bez ceny, bez CAPS lock całego tytułu, bez otaczających cudzysłowów. Wpleć kluczowy atut z notatek (np. suterena), jeśli pasuje.`
    : `- Zwróć JSON: {"description":"...","title":null}.`;

  return `Jesteś copywriterem premium w EstateOS™ — tworzysz opisy nieruchomości na portal.

${localeInstructions(locale)}

FORMAT REDAKCYJNY (zwykły tekst w polu description):
- Obowiązkowa struktura sekcji (każda sekcja = nagłówek w osobnej linii, potem treść):
  1) Akapit wprowadzający (2–3 zdania lifestyle, bez nagłówka)
  2) Nagłówek: Atuty lokalu → lista z "• " (3–6 punktów)
  3) Jeśli JSON.roomAreas nie jest puste — Nagłówek: Układ pomieszczeń
     najpierw 1 zdanie narracyjne, potem lista z metrażami z JSON
  4) (opcjonalnie) linia "——————"
  5) Nagłówek: Okolica i komunikacja → lista z "• " lub krótki akapit + 2–3 punkty
  6) (opcjonalnie) Nagłówek: Dla kogo → 2–3 punkty z "✓ "
  7) Krótkie zaproszenie do kontaktu (1–2 zdania) — ZAWSZE domknięte
- Akapity oddzielone pustą linią.
- Nagłówki sekcji: krótkie, Title Case — bez CAPS lock.
- Lista atutów: "• ". Potwierdzone udogodnienia: "✓ ".
- Wyróżnienie: **pogrubienie** (maks. 4–6 na cały opis).
${emojiRule}

${rewriteBlock}

ZASADY OGÓLNE:
- Opis = narracja marketingowa (styl życia, atmosfera, układ, okolica), nie sucha lista parametrów.
- Wykorzystaj okolicę (POI), ostrożnie: "w pobliżu", bez zmyślonych metrów.
- Nie podawaj dokładnego adresu ulicy, gdy locationPrecision = approximate_circle.
- Nie powtarzaj tytułu oferty w pierwszym zdaniu dosłownie.
${lengthRule}
- roomAreas: wypisz każde pomieszczenie z JSON z dokładną nazwą i metrażem; nie zgaduj.
- NIGDY nie podawaj ceny sprzedaży / czynszu głównego / kaucji / prowizji w zł/€.
- Zakończ pełnym zaproszeniem do kontaktu (nie urywaj zdania).
${titleRule}`;
}

function buildUserPrompt(
  facts: Record<string, unknown>,
  neighborhood: NeighborhoodContext,
  locale: 'pl' | 'en' | 'ru',
  notes: string,
  existingDescription: string,
  generateTitle: boolean,
  targetLength: number,
): string {
  const minLen = targetLength - 150;
  const notesBlock = notes
    ? `\nINSTRUKCJE I FAKTY OD SPRZEDAWCY (OBOWIĄZKOWE — zastosuj w 100% w CAŁYM opisie, nadpisują stary tekst i amenities):\n${notes}\n`
    : '';
  const existingBlock = existingDescription
    ? `\nOBECNY OPIS — TYLKO ŹRÓDŁO FAKTÓW (napisz nową pełną redakcję pod notatki, nie kosmetyczną poprawkę):\n${existingDescription}\n`
    : '';

  const task = notes
    ? `Napisz OD NOWA profesjonalny opis (minimum ${minLen} znaków, cel ${targetLength}) tak, by NOTATKI SPRZEDAWCY były w 100% wplecione w całą narrację — nie dopisek i nie lekka edycja starego tekstu.`
    : `Wygeneruj NOWY opis oferty (minimum ${minLen} znaków, cel ${targetLength}) na podstawie parametrów i okolicy.`;

  return `${task}

PARAMETRY OFERTY (JSON):
${JSON.stringify(facts)}

OKOLICA:
${formatNeighborhood(neighborhood)}
${existingBlock}${notesBlock}
Język wyjściowy: ${locale}.
Odpowiedź WYŁĄCZNIE jako JSON z polami description${generateTitle ? ' i title' : ' oraz title=null'}.`;
}

function stripAiDescription(raw: string): string {
  let text = String(raw || '').trim();
  text = text.replace(/^```(?:markdown|text|json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  text = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  return text;
}

function parseAiJsonPayload(raw: string): { description: string; title: string | null } {
  const cleaned = stripAiDescription(raw);
  try {
    const parsed = JSON.parse(cleaned) as { description?: unknown; title?: unknown };
    const description = stripAiDescription(String(parsed?.description || ''));
    const titleRaw = parsed?.title == null ? '' : String(parsed.title).trim();
    const title = titleRaw ? titleRaw.replace(/^["„]|["”]$/g, '').slice(0, TITLE_MAX_CHARS) : null;
    if (description.length >= 40) return { description, title };
  } catch {
    /* plain text fallback */
  }
  // Model czasem zwraca sam opis bez JSON
  return { description: cleaned, title: null };
}

/**
 * Opis ogłoszenia idzie od razu na gpt-4o-mini.
 * gpt-5-mini na tym projekcie OpenAI zwraca 403, a próba + dociąganie długości
 * przekraczały 60 s i nginx ucinał odpowiedź (aplikacja: „Nie udało się wygenerować opisu GPT”).
 * Mocniejszy model tylko gdy OPENAI_LISTING_REWRITE_MODEL jest ustawiony jawnie.
 */
export function resolveListingDescriptionModel(hasNotes: boolean): string {
  if (hasNotes) {
    return (
      process.env.OPENAI_LISTING_REWRITE_MODEL?.trim() ||
      process.env.OPENAI_LISTING_MODEL?.trim() ||
      OPENAI_MODEL_LEGACY
    );
  }
  return (
    process.env.OPENAI_LISTING_CHEAP_MODEL?.trim() ||
    process.env.OPENAI_LISTING_MODEL?.trim() ||
    OPENAI_MODEL_LEGACY
  );
}

async function expandDescriptionOnce(params: {
  apiKey: string;
  model: string;
  current: string;
  targetLength: number;
  neighborhood: NeighborhoodContext;
  locale: 'pl' | 'en' | 'ru';
  useEmojis: boolean;
  notes: string;
}): Promise<string | null> {
  const missing = params.targetLength - params.current.length;
  if (missing <= 80) return null;
  const minLen = params.targetLength - 150;
  const notesHint = params.notes
    ? `\nZachowaj i wzmocnij przekaz z notatek sprzedawcy (nie wracaj do starych sformułowań):\n${params.notes}\n`
    : '';
  try {
    const { text } = await callOpenAiText({
      apiKey: params.apiKey,
      model: params.model,
      skipReasoningFallback: true,
      logPrefix: 'listing-description-ai-expand',
      maxOutputTokens: maxTokensForLength(Math.min(1600, missing + 400)),
      json: true,
      system: `Rozszerz opis nieruchomości do wymaganej długości. Zwróć JSON {"description":"pełny opis","title":null}.
Cel: minimum ${minLen} znaków, idealnie ${params.targetLength} (±150).
Dopisz fakty: okolica, układ, komunikacja, „dla kogo”, atuty — BEZ lania wody i BEZ powtórzeń.
Domknij wszystkie zdania. Nie urywaj.
${params.useEmojis ? 'Zachowaj oszczędne emoji przy nagłówkach.' : 'Bez emoji.'}
Język: ${params.locale}.`,
      user: `DOTYCHCZASOWY OPIS (${params.current.length} znaków — ZA KRÓTKI):\n${params.current}\n\nOKOLICA:\n${formatNeighborhood(params.neighborhood)}
${notesHint}
Zwróć PEŁNY opis (stary + uzupełnienie) w JSON, długość ≥ ${minLen} znaków.`,
    });
    const { description: next } = parseAiJsonPayload(text);
    return next.length > params.current.length ? next : null;
  } catch {
    return null;
  }
}

export async function generateListingDescriptionWithGpt(
  draft: ListingDescriptionDraftInput,
): Promise<{ description: string; title: string | null; model: string }> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY niedostępny na serwerze.');
  }

  const startedAt = Date.now();
  const locale = resolveLocale(draft.locale);
  const notes = sellerNotes(draft.userNotes);
  const existingDescription = String(draft.existingDescription || '')
    .trim()
    .slice(0, EXISTING_DESCRIPTION_MAX);
  const targetLength = resolveTargetLength(draft.targetLength);
  const useEmojis = resolveUseEmojis(draft.useEmojis);
  const generateTitle = resolveGenerateTitle(draft.generateTitle);
  const hasNotes = Boolean(notes);
  const facts = buildDraftFacts(draft);
  // Rewrite z notatkami: lżejszy kontekst okolicy (mniej tokenów) — i tak notatki rządzą.
  const neighborhood = hasNotes
    ? await buildNeighborhoodContext({
        ...draft,
        lat: draft.lat,
        lng: draft.lng,
      }).then((ctx) => ({
        reverseLabel: ctx.reverseLabel,
        nearbyPlaces: ctx.nearbyPlaces.slice(0, 2),
        note: ctx.note,
      }))
    : await buildNeighborhoodContext(draft);

  const model = resolveListingDescriptionModel(hasNotes);
  const system = buildSystemPrompt(locale, {
    hasNotes,
    hasExisting: Boolean(existingDescription),
    targetLength,
    useEmojis,
    generateTitle,
  });
  const user = buildUserPrompt(
    facts,
    neighborhood,
    locale,
    notes,
    existingDescription,
    generateTitle,
    targetLength,
  );

  const { text, model: usedModel } = await callOpenAiText({
    apiKey,
    model,
    system,
    user,
    maxOutputTokens: maxTokensForLength(targetLength) + (generateTitle ? 100 : 0),
    skipReasoningFallback: true,
    json: true,
    logPrefix: 'listing-description-ai',
  });

  let { description, title } = parseAiJsonPayload(text);
  if (!description || description.length < 80) {
    throw new Error('OpenAI zwróciło zbyt krótki opis.');
  }

  description = fitDescriptionToTarget(description, targetLength);
  // Jedno dociągnięcie tylko gdy pierwsza odpowiedź przyszła szybko i jest wyraźnie za krótka.
  // Drugi przebieg przy 3500 znakach przekraczał 60 s — nginx zwracał 504, a apka ogólny błąd GPT.
  const shortfall = targetLength - description.length;
  if (
    needsDescriptionExpand(description, targetLength) &&
    shortfall > 400 &&
    Date.now() - startedAt < 22000
  ) {
    const expanded = await expandDescriptionOnce({
      apiKey,
      model: usedModel,
      current: description,
      targetLength,
      neighborhood,
      locale,
      useEmojis,
      notes,
    });
    if (expanded) description = fitDescriptionToTarget(expanded, targetLength);
  }
  if (!useEmojis) description = stripEmojiCharacters(description);
  if (!generateTitle) title = null;
  else if (title) title = title.slice(0, TITLE_MAX_CHARS);

  return {
    description: description.slice(0, DESCRIPTION_MAX_CHARS),
    title,
    model: usedModel,
  };
}

export { openAiErrorMessage };

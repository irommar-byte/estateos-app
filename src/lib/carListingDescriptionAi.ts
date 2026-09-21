import { callOpenAiText, getOpenAiApiKey, openAiErrorMessage, resolveOpenAiModel } from "@/lib/openAiClient";

export type CarDescriptionDraftInput = {
  locale?: string;
  vehicleType?: string;
  make?: string;
  model?: string;
  year?: string | number;
  mileageKm?: string | number;
  fuelType?: string;
  transmission?: string;
  bodyType?: string;
  exteriorColor?: string;
  generation?: string;
  enginePower?: string;
  engineCapacity?: string;
  trimVersion?: string;
  doorCount?: string | number | null;
  city?: string;
  localityCountry?: string;
  title?: string;
  existingDescription?: string;
  userNotes?: string;
};

const DESCRIPTION_MAX_CHARS = 4000;
const NOTES_MAX_CHARS = 1500;
const DEFAULT_MAX_OUTPUT_TOKENS = 1800;
const SHORT_MAX_OUTPUT_TOKENS = 700;

function resolveLocale(raw: unknown): "pl" | "en" | "uk" {
  const code = String(raw || "pl").trim().toLowerCase();
  if (code.startsWith("en")) return "en";
  if (code.startsWith("uk") || code.startsWith("ru")) return "uk";
  return "pl";
}

function compactValue(value: unknown): unknown {
  if (value == null) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (Array.isArray(value)) {
    const items = value.map(compactValue).filter((item) => item !== undefined);
    return items.length ? items : undefined;
  }
  if (typeof value === "object") {
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
  return String(raw || "").trim().slice(0, NOTES_MAX_CHARS);
}

function wantsShortDescription(notes: string): boolean {
  return /kr[oó]tk|short\b/i.test(notes);
}

function localeInstructions(locale: "pl" | "en" | "uk"): string {
  if (locale === "en") {
    return "Write the listing description in natural English for a Polish car marketplace audience.";
  }
  if (locale === "uk") {
    return "Напиши опис оголошення природною українською мовою для автомобільного маркетплейсу.";
  }
  return "Napisz opis ogłoszenia naturalną polszczyzną na portal motoryzacyjny.";
}

function buildSystemPrompt(
  locale: "pl" | "en" | "uk",
  options: { hasNotes: boolean; short: boolean },
): string {
  const lengthRule = options.short
    ? "- Długość: ok. 600–900 znaków (3–4 akapity)."
    : "- Długość: pełny, profesjonalny opis — zwykle 1200–3500 znaków, maksimum 4000.";
  const notesRule = options.hasNotes
    ? "- Masz blok INSTRUKCJE I FAKTY OD SPRZEDAWCY. Jest nadrzędny: uwzględnij każdy fakt i polecenie. Ceny dodatków z notatek możesz podać."
    : "- Nie ma notatek sprzedawcy — zbuduj opis wyłącznie z parametrów pojazdu.";

  return `Jesteś copywriterem premium w EstateOS™Car — tworzysz opisy ogłoszeń pojazdów.

${localeInstructions(locale)}

ZASADY:
- To jest NOWY opis z parametrów pojazdu. NIE przepisuj i NIE poprawiaj tekstu z edytora ogłoszenia.
- Opis ma być atrakcyjny i wiarygodny: stan, użytkowanie, charakterystyka, wyposażenie — NIE sucha lista parametrów.
- Parametry z JSON wpleć naturalnie (1–2 zdania), reszta to narracja sprzedażowa.
- Nie wymyślaj historii serwisowej, wypadków, gwarancji ani wyposażenia, jeśli nie wynika to z danych lub notatek.
- Nie podawaj VIN ani numeru rejestracyjnego.
- NIGDY nie podawaj ceny sprzedaży pojazdu ani „do negocjacji” z kwotą — cena główna jest poza opisem.
${notesRule}
${lengthRule}
- Bez emoji, bez nagłówków CAPS, bez list punktowanych parametrów.
- Zakończ krótkim zaproszeniem do kontaktu / oględzin.`;
}

function buildUserPrompt(
  facts: Record<string, unknown>,
  locale: "pl" | "en" | "uk",
  notes: string,
): string {
  const notesBlock = notes
    ? `\nINSTRUKCJE I FAKTY OD SPRZEDAWCY (nadrzędne — zastosuj w całości):\n${notes}\n`
    : "";
  return `Wygeneruj NOWY opis ogłoszenia Cars na podstawie danych (bez ceny, bez przepisywania starego tekstu):

PARAMETRY (JSON):
${JSON.stringify(facts)}
${notesBlock}
Język wyjściowy: ${locale}.`;
}

function stripAiDescription(raw: string): string {
  let text = String(raw || "").trim();
  text = text.replace(/^```(?:markdown|text)?\s*/i, "").replace(/\s*```$/i, "").trim();
  text = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  return text.slice(0, DESCRIPTION_MAX_CHARS);
}

export async function generateCarListingDescriptionWithGpt(
  draft: CarDescriptionDraftInput,
): Promise<{ description: string; model: string }> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY niedostępny na serwerze.");
  }

  const locale = resolveLocale(draft.locale);
  const notes = sellerNotes(draft.userNotes);
  const short = wantsShortDescription(notes);
  const model = resolveOpenAiModel("OPENAI_LISTING_MODEL");
  const facts = compactJson({
    vehicleType: draft.vehicleType || null,
    make: draft.make || null,
    model: draft.model || null,
    year: draft.year || null,
    mileageKm: draft.mileageKm || null,
    fuelType: draft.fuelType || null,
    transmission: draft.transmission || null,
    bodyType: draft.bodyType || null,
    exteriorColor: draft.exteriorColor || null,
    generation: draft.generation || null,
    enginePower: draft.enginePower || null,
    engineCapacity: draft.engineCapacity || null,
    trimVersion: draft.trimVersion || null,
    doorCount: draft.doorCount || null,
    city: draft.city || null,
    localityCountry: draft.localityCountry || null,
    title: draft.title || null,
  });

  const { text, model: usedModel } = await callOpenAiText({
    apiKey,
    model,
    system: buildSystemPrompt(locale, { hasNotes: Boolean(notes), short }),
    user: buildUserPrompt(facts, locale, notes),
    maxOutputTokens: short ? SHORT_MAX_OUTPUT_TOKENS : DEFAULT_MAX_OUTPUT_TOKENS,
    skipReasoningFallback: true,
    logPrefix: "car-listing-description-ai",
  });

  if (!text || text.length < 100) {
    throw new Error("OpenAI zwróciło zbyt krótki opis.");
  }

  return { description: stripAiDescription(text), model: usedModel };
}

export { openAiErrorMessage };

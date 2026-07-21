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
  /** Existing / imported listing text to rewrite or expand. */
  existingDescription?: string;
  /** Extra seller notes for the model. */
  userNotes?: string;
};

function resolveLocale(raw: unknown): "pl" | "en" | "uk" {
  const code = String(raw || "pl").trim().toLowerCase();
  if (code.startsWith("en")) return "en";
  if (code.startsWith("uk") || code.startsWith("ru")) return "uk";
  return "pl";
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

function buildSystemPrompt(locale: "pl" | "en" | "uk"): string {
  return `Jesteś copywriterem premium w EstateOS™Car — tworzysz opisy ogłoszeń pojazdów.

${localeInstructions(locale)}

ZASADY:
- Opis ma być atrakcyjny i wiarygodny: stan, użytkowanie, charakterystyka, wyposażenie — NIE sucha lista parametrów.
- Jeśli podano existingDescription lub userNotes — wykorzystaj je jako bazę (przepisz / rozwiń / ujednolić styl). Nie ignoruj faktów z notatek sprzedawcy.
- Parametry z JSON wpleć naturalnie (1–2 zdania), reszta to narracja sprzedażowa.
- Nie wymyślaj historii serwisowej, wypadków, gwarancji ani wyposażenia, jeśli nie wynika to z danych lub notatek.
- Nie podawaj VIN ani numeru rejestracyjnego.
- NIGDY nie podawaj ceny, kwoty w zł/€ ani „do negocjacji” z liczbą — cena jest poza opisem.
- Długość: ok. 700–1400 znaków (3–6 akapitów).
- Bez emoji, bez nagłówków CAPS, bez list punktowanych parametrów.
- Zakończ krótkim zaproszeniem do kontaktu / oględzin.`;
}

function stripAiDescription(raw: string): string {
  let text = String(raw || "").trim();
  text = text.replace(/^```(?:markdown|text)?\s*/i, "").replace(/\s*```$/i, "").trim();
  text = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  return text.slice(0, 7800);
}

export async function generateCarListingDescriptionWithGpt(
  draft: CarDescriptionDraftInput,
): Promise<{ description: string; model: string }> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY niedostępny na serwerze.");
  }

  const locale = resolveLocale(draft.locale);
  const model = resolveOpenAiModel("OPENAI_LISTING_MODEL");
  const facts = {
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
    existingDescription: String(draft.existingDescription || "").trim() || null,
    userNotes: String(draft.userNotes || "").trim() || null,
  };

  const { text, model: usedModel } = await callOpenAiText({
    apiKey,
    model,
    system: buildSystemPrompt(locale),
    user: `Wygeneruj opis ogłoszenia Cars na podstawie danych (bez ceny):\n\n${JSON.stringify(facts, null, 2)}\n\nJęzyk wyjściowy: ${locale}.`,
    maxOutputTokens: 900,
    logPrefix: "car-listing-description-ai",
  });

  if (!text || text.length < 100) {
    throw new Error("OpenAI zwróciło zbyt krótki opis.");
  }

  return { description: stripAiDescription(text), model: usedModel };
}

export { openAiErrorMessage };

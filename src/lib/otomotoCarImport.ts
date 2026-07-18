import {
  BODY_TYPE_OPTIONS,
  fuelLabelToFuelType,
  gearboxLabelToTransmission,
} from "@/lib/otomotoCatalog";
import {
  defaultBodyTypeForVehicleType,
  inferVehicleTypeFromOtomotoUrl,
  type VehicleType,
} from "@/lib/vehicleTypes";
import { listMissingListingFields, type CarListingMissingFieldKey } from "@/lib/polishRegistrationDocument.shared";

const FETCH_TIMEOUT_MS = 40_000;
const MAX_IMPORT_IMAGES = 24;

export const OTOMOTO_IMPORT_STORAGE_KEY = "estateos_otomoto_car_import_v1";

export type OtomotoCarImportPrefill = {
  vehicleType: VehicleType;
  title: string;
  description: string;
  make: string;
  model: string;
  year: string;
  mileageKm: string;
  fuelType: string;
  transmission: string;
  bodyType: string;
  exteriorColor: string;
  generation: string;
  enginePower: string;
  engineCapacity: string;
  trimVersion: string;
  doorCount: string;
  pricePln: string;
  city: string;
  cityLat: number | null;
  cityLng: number | null;
  localityCountry: string;
  imageUrl: string;
  images: string[];
  sourceUrl: string;
  vin?: string;
  registrationNumber?: string;
  firstRegistrationDate?: string;
};

type DetailParam = {
  key?: unknown;
  value?: unknown;
  label?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stripHtml(input: string): string {
  return input
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*p\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Otomoto often encrypts VIN / plate / first-reg — never treat those blobs as real values. */
export function looksLikeOtomotoEncryptedValue(raw: string): boolean {
  const value = String(raw || "").trim();
  if (!value) return false;
  if (value.includes(".1.")) return true;
  if (value.length >= 32 && /[+=/]/.test(value) && !/^[A-HJ-NPR-Z0-9]{17}$/i.test(value)) {
    return true;
  }
  return false;
}

function paramMap(details: unknown): Record<string, string> {
  const list = Array.isArray(details) ? details : [];
  const out: Record<string, string> = {};
  for (const item of list) {
    const row = item as DetailParam;
    const key = String(row.key || "").trim();
    const value = String(row.value || "").trim();
    if (!key || !value || looksLikeOtomotoEncryptedValue(value)) continue;
    out[key] = value;
  }
  return out;
}

function digitsOnly(raw: string): string {
  return String(raw || "").replace(/[^\d]/g, "");
}

function parseMileageKm(raw: string): string {
  return digitsOnly(raw);
}

function parseEngineCapacity(raw: string): string {
  // Strip units first — digitsOnly("3902 cm3") wrongly kept the trailing "3".
  const cleaned = String(raw || "")
    .replace(/cm[³3]|ccm|\bcc\b/gi, " ")
    .replace(/litr(?:y|ów|a)?|\bl\b/gi, " ");
  return digitsOnly(cleaned);
}

function parseEnginePower(raw: string): string {
  return digitsOnly(raw);
}

function extractVehicleIdsFromText(htmlOrText: string): {
  vin: string;
  registrationNumber: string;
  firstRegistrationDate: string;
} {
  const text = stripHtml(htmlOrText).toUpperCase();
  const vinMatch = text.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
  const dateMatch =
    text.match(
      /(?:PIERWSZ[AEY]\s+REJESTRAC\w*|DATA\s+REJESTRAC\w*|1\.?\s*REJ\.?)[^\d]{0,24}(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i,
    ) || text.match(/\b(\d{2}[./-]\d{2}[./-]\d{4})\b/);
  return {
    vin: vinMatch?.[1] || "",
    registrationNumber: "",
    firstRegistrationDate: dateMatch?.[1]?.replace(/-/g, ".") || "",
  };
}

function mapBodyType(raw: string): string {
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return "Sedan";
  const match = BODY_TYPE_OPTIONS.find(
    (option) =>
      option.label.toLowerCase() === normalized ||
      option.value === normalized ||
      normalized.includes(option.label.toLowerCase()),
  );
  if (match) return match.label;
  if (normalized.includes("terenow") || normalized.includes("suv")) return "SUV";
  if (normalized.includes("city") || normalized.includes("hatch")) return "Hatchback";
  if (normalized.includes("cabrio") || normalized.includes("kabri")) return "Kabriolet";
  if (normalized.includes("minivan") || normalized.includes("van")) return "Van";
  return raw.trim() || "Sedan";
}

export function isSupportedOtomotoOfferUrl(input: string): boolean {
  try {
    normalizeOtomotoOfferUrl(input);
    return true;
  } catch {
    return false;
  }
}

export function normalizeOtomotoOfferUrl(input: string): string {
  const trimmed = String(input || "").trim();
  if (!trimmed) throw new Error("Podaj link do ogłoszenia Otomoto.");

  let parsed: URL;
  try {
    parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    throw new Error("Nieprawidłowy link Otomoto.");
  }

  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
  if (host !== "otomoto.pl") {
    throw new Error("Obsługiwane są wyłącznie linki z otomoto.pl.");
  }

  if (!/\/oferta\//i.test(parsed.pathname)) {
    throw new Error("Wklej bezpośredni link do ogłoszenia Otomoto (…/oferta/…).");
  }

  parsed.hash = "";
  parsed.search = "";
  return parsed.toString();
}

async function fetchOtomotoOfferHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "pl-PL,pl;q=0.9",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Otomoto zwróciło HTTP ${response.status}.`);
    }

    return await response.text();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Przekroczono limit czasu pobierania ogłoszenia Otomoto.");
    }
    throw error instanceof Error ? error : new Error("Błąd pobierania ogłoszenia Otomoto.");
  } finally {
    clearTimeout(timer);
  }
}

function extractAdvertFromHtml(html: string): Record<string, unknown> {
  const match = html.match(/id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (!match?.[1]) {
    throw new Error("Nie udało się odczytać danych ogłoszenia Otomoto.");
  }

  let data: unknown;
  try {
    data = JSON.parse(match[1]);
  } catch {
    throw new Error("Uszkodzona odpowiedź Otomoto — spróbuj ponownie.");
  }

  const pageProps = asRecord(asRecord(asRecord(data).props).pageProps);
  const advert = asRecord(pageProps.advert);
  if (!advert.id && !advert.title) {
    throw new Error("Nie znaleziono ogłoszenia pod tym linkiem (mogło zostać usunięte).");
  }
  return advert;
}

function extractImageUrls(advert: Record<string, unknown>): string[] {
  const images = asRecord(advert.images);
  const photos = Array.isArray(images.photos) ? images.photos : [];
  const urls: string[] = [];
  for (const photo of photos) {
    const row = asRecord(photo);
    const url = String(row.url || row.id || "").split(";")[0].trim();
    if (url.startsWith("http") && !urls.includes(url)) urls.push(url);
    if (urls.length >= MAX_IMPORT_IMAGES) break;
  }
  return urls;
}

export function parseOtomotoAdvert(advert: Record<string, unknown>, sourceUrl: string): OtomotoCarImportPrefill {
  const params = paramMap(advert.details);
  const price = asRecord(advert.price);
  const seller = asRecord(advert.seller);
  const location = asRecord(seller.location);
  const map = asRecord(location.map);

  const make = params.make || "";
  const model = params.model || "";
  const trimVersion = params.version || "";
  const year = digitsOnly(params.year || "").slice(0, 4);
  const title =
    String(advert.title || "").trim() ||
    [make, model, trimVersion].filter(Boolean).join(" ").trim();

  const city = String(location.city || "").trim();
  const latRaw = Number(map.latitude);
  const lngRaw = Number(map.longitude);
  const images = extractImageUrls(advert);

  const gearboxRaw = params.gearbox || "";
  const transmission = gearboxLabelToTransmission(gearboxRaw || "Automatyczna");
  const fuelType = fuelLabelToFuelType(params.fuel_type || "Benzyna");

  // Otomoto encrypts VIN/plate/first-reg in details — only keep plaintext values or parse from description.
  const plainVin = !looksLikeOtomotoEncryptedValue(params.vin || "") ? params.vin || "" : "";
  const plainPlate = !looksLikeOtomotoEncryptedValue(params.registration || "")
    ? params.registration || ""
    : "";
  const plainFirstReg = !looksLikeOtomotoEncryptedValue(params.date_registration || "")
    ? params.date_registration || ""
    : "";
  const fromDescription = extractVehicleIdsFromText(String(advert.description || ""));

  const vehicleType = inferVehicleTypeFromOtomotoUrl(sourceUrl);
  return {
    vehicleType,
    title,
    description: stripHtml(String(advert.description || "")),
    make,
    model,
    year,
    mileageKm: parseMileageKm(params.mileage || ""),
    fuelType,
    transmission,
    bodyType: mapBodyType(params.body_type || "") || defaultBodyTypeForVehicleType(vehicleType),
    exteriorColor: params.color || "",
    generation: params.generation || "",
    enginePower: parseEnginePower(params.engine_power || ""),
    engineCapacity: parseEngineCapacity(params.engine_capacity || ""),
    trimVersion,
    doorCount: digitsOnly(params.door_count || ""),
    pricePln: digitsOnly(String(price.value || "")),
    city,
    cityLat: Number.isFinite(latRaw) ? latRaw : null,
    cityLng: Number.isFinite(lngRaw) ? lngRaw : null,
    localityCountry: "Polska",
    imageUrl: images[0] || "",
    images,
    sourceUrl,
    vin: (plainVin || fromDescription.vin || "").toUpperCase(),
    registrationNumber: (plainPlate || fromDescription.registrationNumber || "").toUpperCase(),
    firstRegistrationDate: plainFirstReg || fromDescription.firstRegistrationDate || "",
  };
}

export async function importCarFromOtomotoUrl(inputUrl: string): Promise<{
  prefill: OtomotoCarImportPrefill;
  missingFields: CarListingMissingFieldKey[];
}> {
  const url = normalizeOtomotoOfferUrl(inputUrl);
  const html = await fetchOtomotoOfferHtml(url);
  const advert = extractAdvertFromHtml(html);
  const prefill = parseOtomotoAdvert(advert, url);
  const missingFields = listMissingListingFields(prefill, prefill.images.length > 0);
  return { prefill, missingFields };
}

export function isRemoteCarImageUrl(url: string): boolean {
  const trimmed = String(url || "").trim();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) return false;
  if (trimmed.includes("/uploads/cars/")) return false;
  return true;
}

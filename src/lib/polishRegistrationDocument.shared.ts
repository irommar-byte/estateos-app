export type ParsedRegistrationDocument = {
  registrationNumber: string;
  make: string;
  model: string;
  variant: string;
  vin: string;
  engineCapacityCm3: string;
  enginePowerKw: string;
  fuelCode: string;
  fuelType: string;
  firstRegistrationDate: string;
  bodyTypeKind: string;
  productionYear: string;
  seatCount: string;
};

export type CarRegistrationPrefill = {
  title: string;
  make: string;
  model: string;
  year: string;
  fuelType: string;
  bodyType: string;
  enginePower: string;
  engineCapacity: string;
  vin: string;
  registrationNumber: string;
  firstRegistrationDate: string;
  trimVersion: string;
};

export type CarListingMissingFieldKey =
  | "pricePln"
  | "description"
  | "mileageKm"
  | "city"
  | "images"
  | "title";

const FUEL_MAP: Record<string, string> = {
  P: "Benzyna",
  D: "Diesel",
  M: "Mieszanka",
  LPG: "LPG",
  CNG: "CNG",
  H: "Wodór",
  LNG: "LNG",
  BD: "Biodiesel",
  E85: "E85",
  EE: "Elektryczny",
  "999": "Inne",
};

function fieldAt(fields: string[], index: number) {
  return String(fields[index] || "").trim();
}

function normalizeDecimal(raw: string) {
  const cleaned = raw.replace(/---/g, "").trim();
  if (!cleaned) return "";
  const parsed = Number(cleaned.replace(",", "."));
  if (!Number.isFinite(parsed)) return cleaned;
  if (parsed === Math.floor(parsed)) return String(Math.floor(parsed));
  return String(parsed);
}

function formatIsoOrRawDate(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "---") return "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;
  return trimmed;
}

export function mapBodyTypeFromKind(kind: string) {
  const upper = kind.toUpperCase();
  if (upper.includes("TERENOW") || upper.includes("SUV")) return "SUV";
  if (upper.includes("KOMBI") || upper.includes("WIELOZADAN")) return "Kombi";
  if (upper.includes("HATCHBACK") || upper.includes("ZWARTY")) return "Hatchback";
  if (upper.includes("COUPE") || upper.includes("COUPÉ")) return "Coupe";
  if (upper.includes("KABRIO")) return "Kabriolet";
  if (upper.includes("DOSTAW") || upper.includes("VAN")) return "Van";
  if (upper.includes("PICKUP")) return "Pickup";
  return "Sedan";
}

export function parseRegistrationFields(fields: string[]): ParsedRegistrationDocument {
  const fuelCode = fieldAt(fields, 50);
  return {
    registrationNumber: fieldAt(fields, 7).toUpperCase().replace(/\s+/g, ""),
    make: fieldAt(fields, 8),
    model: fieldAt(fields, 12),
    variant: fieldAt(fields, 9) || fieldAt(fields, 10),
    vin: fieldAt(fields, 13).toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/gi, ""),
    engineCapacityCm3: normalizeDecimal(fieldAt(fields, 48)),
    enginePowerKw: normalizeDecimal(fieldAt(fields, 49)),
    fuelCode,
    fuelType: FUEL_MAP[fuelCode] || fuelCode,
    firstRegistrationDate: formatIsoOrRawDate(fieldAt(fields, 51)),
    bodyTypeKind: fieldAt(fields, 54),
    productionYear: fieldAt(fields, 56).replace(/\D/g, "").slice(0, 4) || fieldAt(fields, 56),
    seatCount: fieldAt(fields, 52),
  };
}

export function mapToCarFormPrefill(parsed: ParsedRegistrationDocument): CarRegistrationPrefill {
  const capacityNum = Number(parsed.engineCapacityCm3);
  const powerKw = Number(parsed.enginePowerKw);
  const year =
    parsed.productionYear ||
    (parsed.firstRegistrationDate.match(/\d{4}$/)?.[0] ?? "");

  const title = [parsed.make, parsed.model, parsed.variant].filter(Boolean).join(" ").trim();

  return {
    title,
    make: parsed.make,
    model: parsed.model,
    year,
    fuelType: parsed.fuelType,
    bodyType: mapBodyTypeFromKind(parsed.bodyTypeKind),
    enginePower: powerKw > 0 ? `${powerKw} kW` : "",
    engineCapacity: capacityNum > 0 ? `${Math.round(capacityNum)} cm³` : "",
    vin: parsed.vin,
    registrationNumber: parsed.registrationNumber,
    firstRegistrationDate: parsed.firstRegistrationDate,
    trimVersion: parsed.variant,
  };
}

export function listMissingListingFields(
  form: Record<string, unknown>,
  hasImages = false,
): CarListingMissingFieldKey[] {
  const missing: CarListingMissingFieldKey[] = [];
  if (!String(form.title || "").trim()) missing.push("title");
  if (!String(form.description || "").trim()) missing.push("description");
  if (!String(form.mileageKm || "").trim()) missing.push("mileageKm");
  if (!String(form.pricePln || "").trim() || Number(form.pricePln) <= 0) missing.push("pricePln");
  if (!String(form.city || "").trim()) missing.push("city");
  if (!hasImages && !String(form.imageUrl || "").trim()) missing.push("images");
  return missing;
}

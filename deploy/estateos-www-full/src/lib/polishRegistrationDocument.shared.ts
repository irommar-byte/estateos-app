import { defaultBodyTypeForVehicleType, inferVehicleTypeFromCategoryLabel } from "@/lib/vehicleTypes";
export type ParsedRegistrationDocument = {
  registrationNumber: string;
  make: string;
  /** D.3 — nazwa handlowa / model z dowodu (surowe pole 12). */
  commercialModel: string;
  /** Model do katalogu ogłoszenia (np. Seria 5 zamiast 525D). */
  model: string;
  typeCode: string;
  variant: string;
  version: string;
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
  vehicleType?: string;
  title: string;
  make: string;
  model: string;
  year: string;
  fuelType: string;
  bodyType: string;
  generation: string;
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
  const value = String(fields[index] || "").trim();
  return value === "---" ? "" : value;
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

function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

/** D.2 wersja (np. 525D, C220) często ląduje w D.3 zamiast nazwy modelu katalogowej. */
export function looksLikeTrimDesignation(value: string) {
  const compact = value.replace(/\s+/g, "").toUpperCase();
  if (!compact) return false;
  if (/^\d{3}[A-Z]{0,3}$/.test(compact)) return true;
  if (/^[A-Z]\d{2,3}[A-Z]?$/.test(compact)) return true;
  if (/^[A-Z]{1,2}\d{2,4}[A-Z]{0,2}$/.test(compact)) return true;
  return false;
}

export function inferModelFromVin(make: string, vin: string) {
  const brand = make.trim().toUpperCase();
  const value = vin.trim().toUpperCase();
  if (!brand || value.length < 4) return "";

  if (brand.includes("BMW") && value.startsWith("WBA") && value.length >= 4) {
    const series = value[3];
    if (/[1-9]/.test(series)) return `Seria ${series}`;
  }

  if (brand.includes("MERCEDES") && value.length >= 6) {
    const classCode = value.slice(3, 5);
    if (/^[A-Z]\d$/.test(classCode)) return `Klasa ${classCode}`;
  }

  return "";
}

export function inferModelFromTrimDesignation(make: string, designation: string) {
  const brand = make.trim().toUpperCase();
  const compact = designation.replace(/\s+/g, "").toUpperCase();
  if (!compact) return "";

  const bmwNumeric = /^(\d)(\d{2})([A-Z]{0,3})$/.exec(compact);
  if (brand.includes("BMW") && bmwNumeric) {
    return `Seria ${bmwNumeric[1]}`;
  }

  const merc = /^([A-Z])(\d{2,3})([A-Z]?)$/.exec(compact);
  if (brand.includes("MERCEDES") && merc) {
    return `Klasa ${merc[1]}${merc[2].length === 2 ? merc[2] : merc[2].slice(0, 1)}`;
  }

  const audi = /^(A\d|Q\d|RS\d|S\d|TT|R8)/i.exec(compact);
  if (brand.includes("AUDI") && audi) {
    return audi[1].toUpperCase();
  }

  return "";
}

export function resolveCatalogModelName(parsed: Pick<ParsedRegistrationDocument, "make" | "commercialModel" | "typeCode" | "variant" | "version" | "vin">) {
  const commercial = normalizeSpaces(parsed.commercialModel);
  if (commercial && !looksLikeTrimDesignation(commercial)) {
    return commercial;
  }

  const fromVin = inferModelFromVin(parsed.make, parsed.vin);
  if (fromVin) return fromVin;

  const fromTrim = inferModelFromTrimDesignation(parsed.make, commercial || parsed.version || parsed.variant);
  if (fromTrim) return fromTrim;

  return commercial;
}

export function buildTrimVersion(parsed: Pick<ParsedRegistrationDocument, "commercialModel" | "typeCode" | "variant" | "version">) {
  const seen = new Set<string>();
  const parts: string[] = [];
  const commercial = normalizeSpaces(parsed.commercialModel);

  const pushPart = (raw: string) => {
    const trimmed = normalizeSpaces(raw);
    const token = trimmed.replace(/\s+/g, "").toUpperCase();
    if (!trimmed || !token || seen.has(token)) return;
    seen.add(token);
    parts.push(trimmed);
  };

  if (commercial && looksLikeTrimDesignation(commercial)) pushPart(commercial);
  if (parsed.version) pushPart(parsed.version);
  if (parsed.variant) pushPart(parsed.variant);

  return parts.join(" ");
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
  const commercialModel = fieldAt(fields, 12);
  const typeCode = fieldAt(fields, 9);
  const variant = fieldAt(fields, 10);
  const version = fieldAt(fields, 11);
  const make = fieldAt(fields, 8);
  const vin = fieldAt(fields, 13).toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/gi, "");

  const base = {
    registrationNumber: fieldAt(fields, 7).toUpperCase().replace(/\s+/g, ""),
    make,
    commercialModel,
    typeCode,
    variant,
    version,
    vin,
    engineCapacityCm3: normalizeDecimal(fieldAt(fields, 48)),
    enginePowerKw: normalizeDecimal(fieldAt(fields, 49)),
    fuelCode,
    fuelType: FUEL_MAP[fuelCode] || fuelCode,
    firstRegistrationDate: formatIsoOrRawDate(fieldAt(fields, 51)),
    bodyTypeKind: fieldAt(fields, 54),
    productionYear: fieldAt(fields, 56).replace(/\D/g, "").slice(0, 4) || fieldAt(fields, 56),
    seatCount: fieldAt(fields, 52),
  };

  return {
    ...base,
    model: resolveCatalogModelName(base),
  };
}

export function mapToCarFormPrefill(parsed: ParsedRegistrationDocument): CarRegistrationPrefill {
  const capacityNum = Number(parsed.engineCapacityCm3);
  const powerKw = Number(parsed.enginePowerKw);
  const year =
    parsed.productionYear ||
    (parsed.firstRegistrationDate.match(/\d{4}$/)?.[0] ?? "");

  const trimVersion = buildTrimVersion(parsed);
  const title = [parsed.make, parsed.model, trimVersion].filter(Boolean).join(" ").trim();

  const vehicleType = inferVehicleTypeFromCategoryLabel(parsed.bodyTypeKind);
  return {
    vehicleType,
    title,
    make: parsed.make,
    model: parsed.model,
    year,
    fuelType: parsed.fuelType,
    bodyType: mapBodyTypeFromKind(parsed.bodyTypeKind) || defaultBodyTypeForVehicleType(vehicleType),
    generation: parsed.typeCode,
    enginePower: powerKw > 0 ? String(powerKw) : "",
    engineCapacity: capacityNum > 0 ? String(Math.round(capacityNum)) : "",
    vin: parsed.vin,
    registrationNumber: parsed.registrationNumber,
    firstRegistrationDate: parsed.firstRegistrationDate,
    trimVersion,
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

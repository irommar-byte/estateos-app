export type CarListingMissingFieldKey =
  | "pricePln"
  | "description"
  | "mileageKm"
  | "city"
  | "images"
  | "title";

export type CarRegistrationPrefill = {
  title?: string;
  make?: string;
  model?: string;
  year?: string;
  fuelType?: string;
  bodyType?: string;
  generation?: string;
  enginePower?: string;
  engineCapacity?: string;
  vin?: string;
  registrationNumber?: string;
  firstRegistrationDate?: string;
  trimVersion?: string;
};

const MISSING_LABELS: Record<CarListingMissingFieldKey, string> = {
  title: "tytuł",
  description: "opis",
  mileageKm: "przebieg",
  pricePln: "cenę",
  city: "miejscowość",
  images: "zdjęcia",
};

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
  if (!hasImages) missing.push("images");
  return missing;
}

export function missingFieldsMessage(missing: CarListingMissingFieldKey[]) {
  if (!missing.length) return null;
  return `Uzupełnij jeszcze: ${missing.map((key) => MISSING_LABELS[key]).join(", ")}.`;
}

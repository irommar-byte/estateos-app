type CatalogOption = { value: string; label: string };

/** Typ pojazdu w katalogu EstateOS™Car — steruje bazą Otomoto i polami formularza. */
export type VehicleType = "car" | "motorcycle" | "van" | "truck";

export const VEHICLE_TYPE_OPTIONS: Array<{
  value: VehicleType;
  labelPl: string;
  labelEn: string;
  labelUk: string;
  otomotoCategoryId: number;
  /** Czy Otomoto open API ma modele dla tej kategorii. */
  hasModelCatalog: boolean;
  /** Generacje / drzwi typowe dla osobowych. */
  hasDoorCount: boolean;
  hasGenerations: boolean;
}> = [
  {
    value: "car",
    labelPl: "Samochód osobowy",
    labelEn: "Passenger car",
    labelUk: "Легковий автомобіль",
    otomotoCategoryId: 29,
    hasModelCatalog: true,
    hasDoorCount: true,
    hasGenerations: true,
  },
  {
    value: "motorcycle",
    labelPl: "Motocykl",
    labelEn: "Motorcycle",
    labelUk: "Мотоцикл",
    otomotoCategoryId: 65,
    hasModelCatalog: true,
    hasDoorCount: false,
    hasGenerations: false,
  },
  {
    value: "van",
    labelPl: "Dostawczy",
    labelEn: "Van / LCV",
    labelUk: "Фургон / LCV",
    // Dostawcze marki/modele pokrywają się z osobowymi w open API (Transit, Sprinter…).
    otomotoCategoryId: 29,
    hasModelCatalog: true,
    hasDoorCount: true,
    hasGenerations: true,
  },
  {
    value: "truck",
    labelPl: "Ciężarowy",
    labelEn: "Truck",
    labelUk: "Вантажівка",
    otomotoCategoryId: 57,
    // Open API ma marki ciężarówek, ale nie modele — model wpisywany ręcznie.
    hasModelCatalog: false,
    hasDoorCount: false,
    hasGenerations: false,
  },
];

export const DEFAULT_VEHICLE_TYPE: VehicleType = "car";

export function isVehicleType(value: unknown): value is VehicleType {
  return VEHICLE_TYPE_OPTIONS.some((item) => item.value === value);
}

export function normalizeVehicleType(value: unknown): VehicleType {
  return isVehicleType(value) ? value : DEFAULT_VEHICLE_TYPE;
}

export function vehicleTypeMeta(type: VehicleType) {
  return VEHICLE_TYPE_OPTIONS.find((item) => item.value === type) || VEHICLE_TYPE_OPTIONS[0];
}

export function otomotoCategoryIdForVehicleType(type: VehicleType): number {
  return vehicleTypeMeta(type).otomotoCategoryId;
}

export function vehicleTypeSupportsModelCatalog(type: VehicleType): boolean {
  return vehicleTypeMeta(type).hasModelCatalog;
}

export function vehicleTypeSupportsDoorCount(type: VehicleType): boolean {
  return vehicleTypeMeta(type).hasDoorCount;
}

export function vehicleTypeSupportsGenerations(type: VehicleType): boolean {
  return vehicleTypeMeta(type).hasGenerations;
}

export const MOTORCYCLE_BODY_OPTIONS: CatalogOption[] = [
  { value: "naked", label: "Naked" },
  { value: "sport", label: "Sportowy" },
  { value: "touring", label: "Touring" },
  { value: "cruiser", label: "Cruiser" },
  { value: "skuter", label: "Skuter" },
  { value: "enduro", label: "Enduro" },
  { value: "cross", label: "Cross" },
  { value: "chopper", label: "Chopper" },
  { value: "inny", label: "Inny" },
];

export const VAN_BODY_OPTIONS: CatalogOption[] = [
  { value: "furgon", label: "Furgon" },
  { value: "kombi", label: "Kombi" },
  { value: "platforma", label: "Platforma" },
  { value: "chlodnia", label: "Chłodnia" },
  { value: "wymienny", label: "Nadwozie wymienne" },
  { value: "inny", label: "Inny" },
];

export const TRUCK_BODY_OPTIONS: CatalogOption[] = [
  { value: "ciagnik", label: "Ciągnik siodłowy" },
  { value: "podwozie", label: "Podwozie" },
  { value: "wywrotka", label: "Wywrotka" },
  { value: "chlodnia", label: "Chłodnia" },
  { value: "furgon", label: "Furgon" },
  { value: "platforma", label: "Platforma" },
  { value: "cysterna", label: "Cysterna" },
  { value: "inny", label: "Inny" },
];

export function bodyOptionsForVehicleType(type: VehicleType): CatalogOption[] {
  if (type === "motorcycle") return MOTORCYCLE_BODY_OPTIONS;
  if (type === "van") return VAN_BODY_OPTIONS;
  if (type === "truck") return TRUCK_BODY_OPTIONS;
  // car — imported from otomotoCatalog by caller to avoid circular deps; fallback:
  return [
    { value: "sedan", label: "Sedan" },
    { value: "kombi", label: "Kombi" },
    { value: "suv", label: "SUV" },
    { value: "hatchback", label: "Hatchback" },
    { value: "coupe", label: "Coupe" },
    { value: "kabriolet", label: "Kabriolet" },
    { value: "van", label: "Van" },
    { value: "pickup", label: "Pickup" },
    { value: "inny", label: "Inny" },
  ];
}

export function defaultBodyTypeForVehicleType(type: VehicleType): string {
  if (type === "motorcycle") return "Naked";
  if (type === "van") return "Furgon";
  if (type === "truck") return "Ciągnik siodłowy";
  return "Sedan";
}

/** Wykryj typ z URL Otomoto (/osobowe/, /motocykle/, /ciezarowe/, /dostawcze/). */
export function inferVehicleTypeFromOtomotoUrl(url: string): VehicleType {
  const path = String(url || "").toLowerCase();
  if (/\/motocykle\b|\/motocykl\b|\/quad\b/.test(path)) return "motorcycle";
  if (/\/ciezarowe\b|\/ciezarow\b|\/truck\b/.test(path)) return "truck";
  if (/\/dostawcze\b|\/dostawcz/.test(path)) return "van";
  return "car";
}

/** CEPIK / dowód — kategoria pojazdu. */
export function inferVehicleTypeFromCategoryLabel(raw: string): VehicleType {
  const n = String(raw || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (!n) return DEFAULT_VEHICLE_TYPE;
  if (n.includes("motocykl") || n.includes("motorower") || n.includes("skuter") || n.includes("quad")) {
    return "motorcycle";
  }
  if (
    n.includes("ciezar") ||
    n.includes("ciagnik") ||
    n.includes("naczep") ||
    n.includes("przyczep") ||
    n.includes("truck")
  ) {
    return "truck";
  }
  if (n.includes("dostaw") || n.includes("bus ") || n.includes("furgon") || /\blcv\b/.test(n)) {
    return "van";
  }
  if (n.includes("osobow") || n.includes("passenger") || n.includes("samochod")) {
    return "car";
  }
  return DEFAULT_VEHICLE_TYPE;
}

export function vehicleTypeLabel(type: VehicleType, locale: "pl" | "en" | "uk" = "pl"): string {
  const meta = vehicleTypeMeta(type);
  if (locale === "en") return meta.labelEn;
  if (locale === "uk") return meta.labelUk;
  return meta.labelPl;
}

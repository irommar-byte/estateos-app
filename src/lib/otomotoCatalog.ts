export type CatalogOption = {
  value: string;
  label: string;
};

export type CatalogResource =
  | "makes"
  | "models"
  | "generations"
  | "fuel_types"
  | "engine_powers"
  | "engine_capacities"
  | "door_counts"
  | "gearboxes"
  | "versions";

export type CatalogQuery = {
  resource: CatalogResource;
  make?: string;
  model?: string;
  year?: string;
  generation?: string;
  fuel_type?: string;
  engine_power?: string;
  engine_capacity?: string;
  door_count?: string;
  gearbox?: string;
};

const OTOMOTO_BASE = "https://www.otomoto.pl/api/open/categories/29";

type OtomotoOptionsResponse = {
  options?: Record<string, { pl?: string; en?: string }>;
  error?: { message?: string };
};

export function normalizeOtomotoOptions(payload: OtomotoOptionsResponse): CatalogOption[] {
  const options = payload?.options;
  if (!options || typeof options !== "object") return [];

  return Object.entries(options)
    .map(([value, labels]) => ({
      value,
      label: String(labels?.pl || labels?.en || value).trim(),
    }))
    .filter((item) => item.label)
    .sort((a, b) => a.label.localeCompare(b.label, "pl"));
}

function buildCatalogPath(query: CatalogQuery): string {
  const { resource, make, model } = query;
  const makeSlug = String(make || "").trim().toLowerCase();
  const modelSlug = String(model || "").trim().toLowerCase();

  if (resource === "makes") return `${OTOMOTO_BASE}/makes`;

  if (!makeSlug) throw new Error("Parametr make jest wymagany.");
  if (resource === "models") return `${OTOMOTO_BASE}/models/${encodeURIComponent(makeSlug)}`;
  if (!modelSlug) throw new Error("Parametr model jest wymagany.");

  return `${OTOMOTO_BASE}/models/${encodeURIComponent(makeSlug)}/${resource}/${encodeURIComponent(modelSlug)}`;
}

function buildCatalogSearch(query: CatalogQuery): string {
  const params = new URLSearchParams();
  if (query.year) params.set("year", query.year);
  if (query.generation) params.set("generation", query.generation);
  if (query.fuel_type) params.set("fuel_type", query.fuel_type);
  if (query.engine_power) params.set("engine_power", query.engine_power);
  if (query.engine_capacity) params.set("engine_capacity", query.engine_capacity);
  if (query.door_count) params.set("door_count", query.door_count);
  if (query.gearbox) params.set("gearbox", query.gearbox);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export async function fetchOtomotoCatalog(query: CatalogQuery): Promise<CatalogOption[]> {
  const url = `${buildCatalogPath(query)}${buildCatalogSearch(query)}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 * 60 * 12 },
  });

  if (!response.ok) {
    throw new Error(`Katalog aut niedostępny (${response.status}).`);
  }

  const payload = (await response.json()) as OtomotoOptionsResponse;
  if (payload.error?.message) {
    throw new Error(payload.error.message);
  }

  return normalizeOtomotoOptions(payload);
}

export const BODY_TYPE_OPTIONS: CatalogOption[] = [
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

export function gearboxLabelToTransmission(label: string): string {
  const normalized = label.trim().toLowerCase();
  if (normalized.includes("automat")) return "Automatyczna";
  if (normalized.includes("manual")) return "Manualna";
  return label.trim() || "Automatyczna";
}

export function fuelLabelToFuelType(label: string): string {
  const normalized = label.trim().toLowerCase();
  if (normalized.includes("benzyna") && normalized.includes("lpg")) return "Benzyna+LPG";
  if (normalized.includes("benzyna")) return "Benzyna";
  if (normalized.includes("diesel")) return "Diesel";
  if (normalized.includes("plug")) return "Plug-In Hybryda";
  if (normalized.includes("hybryd")) return "Hybryda";
  if (normalized.includes("elektr")) return "Elektryczny";
  if (normalized.includes("wodór") || normalized.includes("wodor")) return "Wodór";
  if (normalized.includes("cng")) return "CNG";
  return label.trim() || "Benzyna";
}

export function parseCatalogQuery(searchParams: URLSearchParams): CatalogQuery {
  const resource = String(searchParams.get("resource") || "").trim() as CatalogResource;
  return {
    resource,
    make: String(searchParams.get("make") || "").trim() || undefined,
    model: String(searchParams.get("model") || "").trim() || undefined,
    year: String(searchParams.get("year") || "").trim() || undefined,
    generation: String(searchParams.get("generation") || "").trim() || undefined,
    fuel_type: String(searchParams.get("fuel_type") || "").trim() || undefined,
    engine_power: String(searchParams.get("engine_power") || "").trim() || undefined,
    engine_capacity: String(searchParams.get("engine_capacity") || "").trim() || undefined,
    door_count: String(searchParams.get("door_count") || "").trim() || undefined,
    gearbox: String(searchParams.get("gearbox") || "").trim() || undefined,
  };
}

export const CATALOG_RESOURCES: CatalogResource[] = [
  "makes",
  "models",
  "generations",
  "fuel_types",
  "engine_powers",
  "engine_capacities",
  "door_counts",
  "gearboxes",
  "versions",
];

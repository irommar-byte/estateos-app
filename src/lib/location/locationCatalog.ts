export type DistrictCatalog = Record<string, string[]>;

const STRICT_CITY_DISTRICTS: DistrictCatalog = {
  Warszawa: [
    "Bemowo", "Białołęka", "Bielany", "Mokotów", "Ochota", "Praga-Południe", "Praga-Północ", "Rembertów",
    "Śródmieście", "Targówek", "Ursus", "Ursynów", "Wawer", "Wesoła", "Wilanów", "Włochy", "Wola", "Żoliborz",
  ],
  Kraków: [
    "Stare Miasto", "Grzegórzki", "Prądnik Czerwony", "Prądnik Biały", "Krowodrza", "Bronowice", "Zwierzyniec",
    "Dębniki", "Łagiewniki-Borek Fałęcki", "Swoszowice", "Podgórze Duchackie", "Bieżanów-Prokocim", "Podgórze",
    "Czyżyny", "Mistrzejowice", "Bieńczyce", "Wzgórza Krzesławickie", "Nowa Huta",
  ],
  Wrocław: ["Stare Miasto", "Śródmieście", "Krzyki", "Fabryczna", "Psie Pole"],
  Poznań: ["Stare Miasto", "Nowe Miasto", "Jeżyce", "Grunwald", "Wilda"],
  "Łódź": ["Bałuty", "Górna", "Polesie", "Śródmieście", "Widzew"],
  Lublin: [
    "Śródmieście", "Czechów Północny", "Czechów Południowy", "Czuby Północne", "Czuby Południowe", "LSM", "Rury",
    "Kalinowszczyzna", "Tatary", "Bronowice", "Dziesiąta", "Wrotków", "Sławinek", "Sławin", "Węglin Północny",
    "Węglin Południowy", "Ponikwoda", "Hajdów-Zadębie", "Za Cukrownią", "Abramowice",
  ],
  Gdańsk: [
    "Śródmieście", "Wrzeszcz Górny", "Wrzeszcz Dolny", "Oliwa", "Przymorze Małe", "Przymorze Wielkie", "Zaspa-Młyniec",
    "Zaspa-Rozstaje", "Jasień", "Chełm", "Ujeścisko-Łostowice", "Piecki-Migowo", "Osowa", "Brzeźno", "Nowy Port",
    "Orunia-Św. Wojciech-Lipce", "Stogi", "Żabianka-Wejhera-Jelitkowo-Tysiąclecia",
  ],
  Gdynia: [
    "Śródmieście", "Orłowo", "Redłowo", "Wzgórze Św. Maksymiliana", "Działki Leśne", "Grabówek", "Chylonia", "Oksywie",
    "Obłuże", "Karwiny", "Dąbrowa", "Wielki Kack", "Mały Kack", "Pogórze", "Cisowa", "Leszczynki",
  ],
  Sopot: ["Dolny Sopot", "Górny Sopot", "Kamienny Potok", "Brodwino", "Karlikowo", "Przylesie", "Sopot Wyścigi"],
  Katowice: [
    "Śródmieście", "Załęże", "Załęska Hałda-Brynów", "Osiedle Tysiąclecia", "Koszutka", "Bogucice", "Dąb", "Ligota-Panewniki",
    "Piotrowice-Ochojec", "Giszowiec", "Szopienice-Burowiec", "Murcki", "Wełnowiec-Józefowiec", "Janów-Nikiszowiec",
  ],
  Rybnik: [
    "Śródmieście", "Boguszowice Osiedle", "Boguszowice Stare", "Chwałęcice", "Chwałowice", "Golejów", "Gotartowice", "Kamień",
    "Kłokocin", "Ligota-Ligocka Kuźnia", "Meksyk", "Niedobczyce", "Niewiadom", "Ochojec", "Orzepowice", "Paruszowiec-Piaski",
    "Popielów", "Radziejów", "Rybnicka Kuźnia", "Smolna", "Stodoły", "Wielopole", "Zamysłów", "Zebrzydowice",
  ],
  Białystok: [
    "Centrum", "Białostoczek", "Bojary", "Dziesięciny I", "Dziesięciny II", "Antoniuk", "Piaski", "Przydworcowe",
    "Sienkiewicza", "Młodych", "Starosielce", "Nowe Miasto", "Wysoki Stoczek", "Zielone Wzgórza", "Słoneczny Stok",
    "Leśna Dolina", "Bacieczki", "Jaroszówka", "Dojlidy", "Skorupy", "Zawady",
  ],
  "Zamość": ["Stare Miasto", "Nowe Miasto", "Planty", "Janowice", "Karolówka", "Promyk", "Powiatowa", "Rataja", "Zamczysko", "Słoneczny Stok"],
};

const CITY_ALIASES: Record<string, string> = {
  trojmiasto: "Gdańsk",
  "trojmiasto gdańsk": "Gdańsk",
  "trojmiasto gdynia": "Gdynia",
  "trojmiasto sopot": "Sopot",
  lodz: "Łódź",
  gdansk: "Gdańsk",
  bialystok: "Białystok",
  zamosc: "Zamość",
};

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function getStrictDistrictCatalog(): DistrictCatalog {
  return STRICT_CITY_DISTRICTS;
}

export function getStrictCities(): string[] {
  return Object.keys(STRICT_CITY_DISTRICTS);
}

export function canonicalizeCity(input?: string | null): string {
  const value = String(input || "").trim();
  if (!value) {
    return "";
  }

  const alias = CITY_ALIASES[normalizeText(value)];
  const candidate = alias || value;
  const normalizedCandidate = normalizeText(candidate);

  const strictHit = getStrictCities().find((city) => normalizeText(city) === normalizedCandidate);
  return strictHit || candidate;
}

export function isStrictCity(city?: string | null): boolean {
  const canonical = canonicalizeCity(city);
  return Boolean(canonical && STRICT_CITY_DISTRICTS[canonical]);
}

export function getDistrictsForCity(city?: string | null): string[] {
  const canonical = canonicalizeCity(city);
  return STRICT_CITY_DISTRICTS[canonical] || [];
}

export function canonicalizeDistrict(city: string, district?: string | null): string {
  const value = String(district || "").trim();
  if (!value) {
    return "";
  }

  const districts = getDistrictsForCity(city);
  if (!districts.length) {
    return value;
  }

  const normalized = normalizeText(value);
  const strictHit = districts.find((entry) => normalizeText(entry) === normalized);
  return strictHit || value;
}

export function validateCityDistrict(city?: string | null, district?: string | null): {
  valid: boolean;
  strictCity: boolean;
  city: string;
  district: string;
  message?: string;
} {
  const canonicalCity = canonicalizeCity(city);
  const canonicalDistrict = canonicalizeDistrict(canonicalCity, district);
  const strictCity = isStrictCity(canonicalCity);

  if (!canonicalCity) {
    return {
      valid: false,
      strictCity,
      city: canonicalCity,
      district: canonicalDistrict,
      message: "Miasto jest wymagane.",
    };
  }

  if (strictCity) {
    const allowed = getDistrictsForCity(canonicalCity);
    const allowedHit = allowed.some((entry) => normalizeText(entry) === normalizeText(canonicalDistrict));
    if (!allowedHit) {
      return {
        valid: false,
        strictCity,
        city: canonicalCity,
        district: canonicalDistrict,
        message: `Dzielnica '${canonicalDistrict || "-"}' nie należy do listy dla miasta ${canonicalCity}.`,
      };
    }
  }

  return {
    valid: true,
    strictCity,
    city: canonicalCity,
    district: canonicalDistrict || "Inny obszar",
  };
}

type MapboxContextItem = { id?: string; text?: string; text_pl?: string };

function mapboxContextText(item: MapboxContextItem | null | undefined): string {
  return String(item?.text_pl || item?.text || "").trim();
}

/** Wyciąga nazwę miasta z odpowiedzi Geocoding API (forward / reverse). */
export function inferCityFromMapboxFeature(feature: {
  context?: MapboxContextItem[];
  place_name?: string;
  place_name_pl?: string;
  text?: string;
} | null | undefined): string {
  const context = Array.isArray(feature?.context) ? feature.context : [];
  const placeItem = context.find((c) => String(c?.id || "").startsWith("place"));
  const localityItem = context.find((c) => String(c?.id || "").startsWith("locality"));
  const fromContext = mapboxContextText(placeItem) || mapboxContextText(localityItem);
  if (fromContext) {
    return canonicalizeCity(fromContext);
  }

  const placeName = String(feature?.place_name_pl || feature?.place_name || "").trim();
  if (placeName) {
    const parts = placeName.split(",").map((s) => s.trim()).filter(Boolean);
    for (let i = parts.length - 1; i >= 0; i--) {
      const segment = parts[i].replace(/^\d{2}-\d{3}\s+/i, "").trim();
      if (!segment) continue;
      if (/województwo|polska|poland|^pl$/i.test(segment)) continue;
      const c = canonicalizeCity(segment);
      if (c) return c;
    }
  }

  return canonicalizeCity(String(feature?.text || "").trim());
}

/**
 * Dopasowuje dzielnicę z katalogu EstateOS na podstawie kontekstu Mapbox (forward / reverse).
 * Działa tylko dla „strict” miast z listy.
 */
export function inferStrictDistrictFromMapboxFeature(
  canonicalCity: string,
  feature: {
    context?: MapboxContextItem[];
    place_name?: string;
    place_name_pl?: string;
  } | null | undefined,
): string {
  if (!canonicalCity || !isStrictCity(canonicalCity)) {
    return "";
  }

  const allowed = getDistrictsForCity(canonicalCity);
  if (!allowed.length) return "";

  const tryValidDistrict = (raw: string): string => {
    const trimmed = String(raw || "").trim();
    if (!trimmed) return "";
    const v = validateCityDistrict(canonicalCity, trimmed);
    return v.valid ? v.district : "";
  };

  const context = Array.isArray(feature?.context) ? feature.context : [];

  const prefixesOrdered = ["neighborhood", "district", "locality"];
  for (const prefix of prefixesOrdered) {
    for (const item of context) {
      if (!String(item?.id || "").startsWith(prefix)) continue;
      const hit = tryValidDistrict(mapboxContextText(item));
      if (hit) return hit;
    }
  }

  for (const item of context) {
    const id = String(item?.id || "");
    if (id.startsWith("postcode") || id.startsWith("country") || id.startsWith("region") || id.startsWith("place")) {
      continue;
    }
    const hit = tryValidDistrict(mapboxContextText(item));
    if (hit) return hit;
  }

  const placeName = String(feature?.place_name_pl || feature?.place_name || "").trim();
  if (placeName) {
    const segments = placeName.split(",").map((s) => s.trim()).filter(Boolean);
    for (const seg of segments) {
      const cleaned = seg.replace(/^\d{2}-\d{3}\s+/i, "").replace(/^dzielnica\s+/i, "").trim();
      const hit = tryValidDistrict(cleaned) || tryValidDistrict(seg);
      if (hit) return hit;
    }
  }

  const texts: string[] = [];
  for (const item of context) {
    const t = mapboxContextText(item);
    if (t) texts.push(t);
  }
  if (placeName) {
    placeName.split(",").forEach((s) => {
      const t = s.trim();
      if (t) texts.push(t);
    });
  }

  const norm = (s: string) => normalizeText(s);
  for (const candidate of texts) {
    const nc = norm(candidate);
    if (!nc) continue;
    for (const d of allowed) {
      const nd = norm(d);
      if (!nd) continue;
      if (nc === nd || nc.includes(nd) || nd.includes(nc)) {
        const v = validateCityDistrict(canonicalCity, d);
        if (v.valid) return v.district;
      }
    }
  }

  return "";
}


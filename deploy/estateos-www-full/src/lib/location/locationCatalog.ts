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

/** Pod-dzielnice / synonimy OtoDom → oficjalna dzielnica w katalogu EstateOS. */
const DISTRICT_ALIAS_RULES: Array<{ city: string; patterns: string[]; district: string }> = [
  {
    city: "Warszawa",
    patterns: [
      "nowa praga", "stara praga", "praga polnoc", "praga pn", "praga-polnoc", "praga północ",
      "florianska", "floryanska", "zabkowska", "stalowa", "inzynierska", "inżynierska",
    ],
    district: "Praga-Północ",
  },
  {
    city: "Warszawa",
    patterns: [
      "saska kepa", "saska kępa", "goclaw", "gocław", "goclawek", "gocławek", "kamionek",
      "olszynka grochowska", "praga poludnie", "praga południe", "praga pd",
    ],
    district: "Praga-Południe",
  },
  {
    city: "Warszawa",
    patterns: ["mokotow", "mokotów", "sluzew", "służew", "sluzewiec", "służewiec", "wierzbno", "stegny"],
    district: "Mokotów",
  },
  {
    city: "Warszawa",
    patterns: ["ursynow", "ursynów", "kabaty", "imielin", "natolin"],
    district: "Ursynów",
  },
  {
    city: "Warszawa",
    patterns: ["wola", "mirów", "mlynarska", "młynarska", "czyste"],
    district: "Wola",
  },
  {
    city: "Warszawa",
    patterns: ["zoliborz", "żoliborz", "stary zoliborz", "stary żoliborz"],
    district: "Żoliborz",
  },
  {
    city: "Poznań",
    patterns: [
      "ogrody", "goplana", "osiedle goplana", "sw wawrzynca", "sw. wawrzyńca", "wawrzynca", "wawrzyńca",
      "strzeszyn", "podolany", "sołacz", "solacz", "winogrady", "wola poznan", "wola poznań",
    ],
    district: "Jeżyce",
  },
  {
    city: "Poznań",
    patterns: ["lazarz", "łazarz", "górczyn", "gorczyn", "sw lazara", "sw. Łazarza"],
    district: "Grunwald",
  },
  {
    city: "Poznań",
    patterns: ["rataje", "starołęka", "staroleka", "chartowo", "minikowo", "marlewo"],
    district: "Nowe Miasto",
  },
  {
    city: "Poznań",
    patterns: ["jezyce", "jeżyce", "golęcin", "golecin"],
    district: "Jeżyce",
  },
  {
    city: "Kraków",
    patterns: ["kazimierz", "salwator", "salwatora", "dębniki", "debniki", "piasek", "podgórze", "podgorze"],
    district: "Dębniki",
  },
  {
    city: "Wrocław",
    patterns: ["krzyki", "gaj", "partynice", "przedmieście oławskie", "przedmiescie olawskie"],
    district: "Krzyki",
  },
];

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

/** Puste placeholdery z OtoDom / formularzy — nie traktujemy jako nazwy dzielnicy. */
export function isPlaceholderDistrict(value?: string | null): boolean {
  const raw = String(value ?? "").trim();
  if (!raw) return true;
  const normalized = normalizeText(raw);
  if (!normalized) return true;
  if (["-", "--", "—", ".", "..", "x", "xx", "brak", "unknown", "n/a", "na", "none", "null"].includes(normalized)) {
    return true;
  }
  if (normalized === "inny obszar") return true;
  return false;
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

/** Dopasowuje synonim (np. „Nowa Praga”) do dzielnicy z katalogu strict city. */
export function matchDistrictAlias(city: string, rawDistrict?: string | null): string {
  const canonicalCity = canonicalizeCity(city);
  if (!canonicalCity || !isStrictCity(canonicalCity)) return "";

  const rawNorm = normalizeText(String(rawDistrict || "").trim());
  if (!rawNorm || rawNorm === "inny obszar") return "";

  for (const rule of DISTRICT_ALIAS_RULES) {
    if (canonicalizeCity(rule.city) !== canonicalCity) continue;
    for (const pattern of rule.patterns) {
      const patternNorm = normalizeText(pattern);
      if (!patternNorm) continue;
      if (rawNorm === patternNorm || rawNorm.includes(patternNorm) || patternNorm.includes(rawNorm)) {
        const allowed = getDistrictsForCity(canonicalCity);
        if (allowed.some((entry) => normalizeText(entry) === normalizeText(rule.district))) {
          return rule.district;
        }
      }
    }
  }

  return "";
}

/** Szuka nazwy dzielnicy z katalogu w dowolnym tekście (np. place_name z Mapbox). */
export function pickDistrictFromPlaceName(city: string, text: string, allowedDistricts?: string[]): string {
  const canonicalCity = canonicalizeCity(city);
  if (!canonicalCity || !text) return "";

  const alias = matchDistrictAlias(canonicalCity, text);
  if (alias) return alias;

  const candidates =
    allowedDistricts && allowedDistricts.length > 0
      ? allowedDistricts
      : getDistrictsForCity(canonicalCity);
  if (!candidates.length) return "";

  const source = normalizeText(text);
  if (!source) return "";

  for (const district of candidates) {
    const nd = normalizeText(district);
    if (!nd) continue;
    if (source.includes(nd)) {
      return district;
    }
  }

  return "";
}

export function canonicalizeDistrict(city: string, district?: string | null): string {
  const value = String(district || "").trim();
  if (isPlaceholderDistrict(value)) {
    return "";
  }

  const canonicalCity = canonicalizeCity(city);
  const aliasHit = matchDistrictAlias(canonicalCity, value);
  if (aliasHit) return aliasHit;

  const districts = getDistrictsForCity(canonicalCity);
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
    const aliasDistrict = matchDistrictAlias(canonicalCity, canonicalDistrict);
    const districtToCheck = aliasDistrict || canonicalDistrict;
    if (isPlaceholderDistrict(districtToCheck)) {
      return {
        valid: false,
        strictCity,
        city: canonicalCity,
        district: "",
        message: `Wybierz dzielnicę z listy dla miasta ${canonicalCity}.`,
      };
    }
    const allowedHit = allowed.some((entry) => normalizeText(entry) === normalizeText(districtToCheck));
    if (!allowedHit) {
      return {
        valid: false,
        strictCity,
        city: canonicalCity,
        district: districtToCheck,
        message: `Dzielnica '${districtToCheck || "-"}' nie należy do listy dla miasta ${canonicalCity}.`,
      };
    }
    return {
      valid: true,
      strictCity,
      city: canonicalCity,
      district: districtToCheck,
    };
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

function mapboxContextByPrefix(context: MapboxContextItem[], prefix: string): string {
  for (const item of context) {
    if (String(item?.id || "").startsWith(prefix)) {
      const t = mapboxContextText(item);
      if (t) return t;
    }
  }
  return "";
}

/** Obszar / gmina / powiat dla miejscowości spoza listy dzielnic (np. Kalwaria Zebrzydowska). */
export function inferAreaLabelFromMapboxFeature(
  canonicalCity: string,
  feature: {
    context?: MapboxContextItem[];
    place_name?: string;
    place_name_pl?: string;
  } | null | undefined,
): string {
  if (!feature) return "";
  if (canonicalCity && isStrictCity(canonicalCity)) {
    return inferStrictDistrictFromMapboxFeature(canonicalCity, feature);
  }

  const context = Array.isArray(feature.context) ? feature.context : [];
  const neighborhood = mapboxContextByPrefix(context, "neighborhood");
  const district = mapboxContextByPrefix(context, "district");
  const locality = mapboxContextByPrefix(context, "locality");

  const pick =
    (neighborhood && neighborhood !== canonicalCity ? neighborhood : "") ||
    (district && !/województwo/i.test(district) ? district : "") ||
    (locality && locality !== canonicalCity ? locality : "");

  if (pick) return pick.trim();

  const placeName = String(feature.place_name_pl || feature.place_name || "").trim();
  if (!placeName || !canonicalCity) return "";
  const segments = placeName.split(",").map((s) => s.trim()).filter(Boolean);
  for (const seg of segments) {
    const cleaned = seg.replace(/^\d{2}-\d{3}\s+/i, "").trim();
    if (!cleaned || cleaned === canonicalCity) continue;
    if (/województwo|polska|poland|powiat/i.test(cleaned)) {
      if (/powiat/i.test(cleaned)) return cleaned;
      continue;
    }
    return cleaned;
  }
  return "";
}

/** Wyciąga nazwę miasta z odpowiedzi Geocoding API (forward / reverse). */
export function inferCityFromMapboxFeature(feature: {
  context?: MapboxContextItem[];
  place_name?: string;
  place_name_pl?: string;
  text?: string;
} | null | undefined): string {
  const context = Array.isArray(feature?.context) ? feature.context : [];
  const locality = mapboxContextByPrefix(context, "locality");
  const place = mapboxContextByPrefix(context, "place");
  const fromContext = locality || place;
  if (fromContext) {
    return canonicalizeCity(fromContext);
  }

  const placeName = String(feature?.place_name_pl || feature?.place_name || "").trim();
  if (placeName) {
    const parts = placeName.split(",").map((s) => s.trim()).filter(Boolean);
    for (let i = parts.length - 1; i >= 0; i--) {
      const segment = parts[i].replace(/^\d{2}-\d{3}\s+/i, "").trim();
      if (!segment) continue;
      if (/województwo|polska|poland|^pl$|niemcy|germany|deutschland|^de$|bayern|bavaria|czechy|czechia|slovakia|austria|ukraina|ukraine/i.test(segment)) continue;
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
    const alias = matchDistrictAlias(canonicalCity, trimmed);
    if (alias) return alias;
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


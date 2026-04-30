export type LocationCatalogPayload = {
  strictCities: string[];
  strictCityDistricts: Record<string, string[]>;
};

const API_URL = "https://estateos.pl";

const FALLBACK_CATALOG: LocationCatalogPayload = {
  strictCities: [
    "Warszawa",
    "Kraków",
    "Wrocław",
    "Poznań",
    "Łódź",
    "Lublin",
    "Gdańsk",
    "Gdynia",
    "Sopot",
    "Katowice",
    "Rybnik",
    "Białystok",
    "Zamość",
  ],
  strictCityDistricts: {
    Warszawa: ["Bemowo", "Białołęka", "Bielany", "Mokotów", "Ochota", "Praga-Południe", "Praga-Północ", "Rembertów", "Śródmieście", "Targówek", "Ursus", "Ursynów", "Wawer", "Wesoła", "Wilanów", "Włochy", "Wola", "Żoliborz"],
    Kraków: ["Stare Miasto", "Grzegórzki", "Prądnik Czerwony", "Prądnik Biały", "Krowodrza", "Bronowice", "Zwierzyniec", "Dębniki", "Łagiewniki-Borek Fałęcki", "Swoszowice", "Podgórze Duchackie", "Bieżanów-Prokocim", "Podgórze", "Czyżyny", "Mistrzejowice", "Bieńczyce", "Wzgórza Krzesławickie", "Nowa Huta"],
    Wrocław: ["Stare Miasto", "Śródmieście", "Krzyki", "Fabryczna", "Psie Pole"],
    Poznań: ["Stare Miasto", "Nowe Miasto", "Jeżyce", "Grunwald", "Wilda"],
    "Łódź": ["Bałuty", "Górna", "Polesie", "Śródmieście", "Widzew"],
    Lublin: ["Śródmieście", "Czechów Północny", "Czechów Południowy", "Czuby Północne", "Czuby Południowe", "LSM", "Rury", "Kalinowszczyzna", "Tatary", "Bronowice", "Dziesiąta", "Wrotków", "Sławinek", "Sławin", "Węglin Północny", "Węglin Południowy", "Ponikwoda", "Hajdów-Zadębie", "Za Cukrownią", "Abramowice"],
    Gdańsk: ["Śródmieście", "Wrzeszcz Górny", "Wrzeszcz Dolny", "Oliwa", "Przymorze Małe", "Przymorze Wielkie", "Zaspa-Młyniec", "Zaspa-Rozstaje", "Jasień", "Chełm", "Ujeścisko-Łostowice", "Piecki-Migowo", "Osowa", "Brzeźno", "Nowy Port", "Orunia-Św. Wojciech-Lipce", "Stogi", "Żabianka-Wejhera-Jelitkowo-Tysiąclecia"],
    Gdynia: ["Śródmieście", "Orłowo", "Redłowo", "Wzgórze Św. Maksymiliana", "Działki Leśne", "Grabówek", "Chylonia", "Oksywie", "Obłuże", "Karwiny", "Dąbrowa", "Wielki Kack", "Mały Kack", "Pogórze", "Cisowa", "Leszczynki"],
    Sopot: ["Dolny Sopot", "Górny Sopot", "Kamienny Potok", "Brodwino", "Karlikowo", "Przylesie", "Sopot Wyścigi"],
    Katowice: ["Śródmieście", "Załęże", "Załęska Hałda-Brynów", "Osiedle Tysiąclecia", "Koszutka", "Bogucice", "Dąb", "Ligota-Panewniki", "Piotrowice-Ochojec", "Giszowiec", "Szopienice-Burowiec", "Murcki", "Wełnowiec-Józefowiec", "Janów-Nikiszowiec"],
    Rybnik: ["Śródmieście", "Boguszowice Osiedle", "Boguszowice Stare", "Chwałęcice", "Chwałowice", "Golejów", "Gotartowice", "Kamień", "Kłokocin", "Ligota-Ligocka Kuźnia", "Meksyk", "Niedobczyce", "Niewiadom", "Ochojec", "Orzepowice", "Paruszowiec-Piaski", "Popielów", "Radziejów", "Rybnicka Kuźnia", "Smolna", "Stodoły", "Wielopole", "Zamysłów", "Zebrzydowice"],
    Białystok: ["Centrum", "Białostoczek", "Bojary", "Dziesięciny I", "Dziesięciny II", "Antoniuk", "Piaski", "Przydworcowe", "Sienkiewicza", "Młodych", "Starosielce", "Nowe Miasto", "Wysoki Stoczek", "Zielone Wzgórza", "Słoneczny Stok", "Leśna Dolina", "Bacieczki", "Jaroszówka", "Dojlidy", "Skorupy", "Zawady"],
    "Zamość": ["Stare Miasto", "Nowe Miasto", "Planty", "Janowice", "Karolówka", "Promyk", "Powiatowa", "Rataja", "Zamczysko", "Słoneczny Stok"],
  },
};

let cachedCatalog: LocationCatalogPayload | null = null;

const sanitize = (payload: any): LocationCatalogPayload => {
  const strictCities = Array.isArray(payload?.strictCities)
    ? payload.strictCities.filter((city: unknown): city is string => typeof city === "string" && city.trim().length > 0)
    : [];
  const strictCityDistricts = payload?.strictCityDistricts && typeof payload.strictCityDistricts === "object"
    ? Object.fromEntries(
        Object.entries(payload.strictCityDistricts).map(([city, districts]) => [
          city,
          Array.isArray(districts)
            ? districts.filter((district): district is string => typeof district === "string" && district.trim().length > 0)
            : [],
        ])
      )
    : {};
  return {
    strictCities: strictCities.length > 0 ? strictCities : Object.keys(strictCityDistricts),
    strictCityDistricts,
  };
};

export async function fetchLocationCatalog(forceRefresh = false): Promise<LocationCatalogPayload> {
  if (cachedCatalog && !forceRefresh) {
    return cachedCatalog;
  }
  try {
    const response = await fetch(`${API_URL}/api/mobile/v1/locations`);
    const json = await response.json();
    if (response.ok && json?.success) {
      cachedCatalog = sanitize(json);
      return cachedCatalog;
    }
  } catch (error) {
    // network fallback
  }
  cachedCatalog = FALLBACK_CATALOG;
  return FALLBACK_CATALOG;
}

export function getFallbackLocationCatalog(): LocationCatalogPayload {
  return FALLBACK_CATALOG;
}

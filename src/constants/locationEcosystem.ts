/** Oferty spoza listy głównych aglomeracji — miejscowość trzymamy w `district` (np. „Przemyśl”). */
export const REST_OF_COUNTRY_CITY = 'Reszta kraju' as const;

export function formatLocationLabel(cityInput: unknown, districtInput: unknown, fallback = 'Polska'): string {
  const city = String(cityInput ?? '').trim();
  const district = String(districtInput ?? '').trim();
  if (city === REST_OF_COUNTRY_CITY) return district || fallback;
  if (city && district) return `${city}, ${district}`;
  if (city) return city;
  if (district) return district;
  return fallback;
}

/**
 * Czy oferta ma włączoną „Dokładną lokalizację".
 * Domyślnie TRUE (zgodnie z polem domyślnym w useOfferStore i Step2).
 * Wyłączone tylko wtedy, gdy wartość jednoznacznie wskazuje na FALSE.
 */
export function resolveIsExactLocation(value: unknown): boolean {
  if (value === false || value === 0 || value === '0' || value === 'false') return false;
  return true;
}

/**
 * Usuwa końcowy numer budynku/mieszkania z nazwy ulicy.
 *
 * KIEDY UŻYWAMY
 * ─────────────
 * Przełącznik „Dokładna lokalizacja" w aplikacji rozróżnia dwa publicznie
 * widoczne tryby:
 *  • ON  → pokazujemy ulicę razem z numerem (pełny adres),
 *  • OFF → pokazujemy SAMĄ ulicę (bez numeru) — kupujący wie, „w której
 *          ulicy" jest oferta, ale nie zna dokładnego adresu.
 *
 * Ten helper bezpiecznie odcina TYLKO ostatni segment numerowy, łącznie
 * z opcjonalną literą („5A"), separatorem „/" lub „-" i drugim numerem
 * („27/29", „23a/15"), oraz „nr/numer" prefix („nr 12", „numer 12").
 *
 * Co świadomie ZACHOWUJEMY
 * ────────────────────────
 *  • cyfry w ŚRODKU nazwy ulicy („3 Maja", „Aleja 700-lecia", „1 Sierpnia"),
 *  • cyfry rzymskie po nazwie („Jana Pawła II"),
 *  • prefiksy „ul.", „al.", „pl." w oryginalnej formie.
 */
export function stripHouseNumber(streetInput: unknown): string {
  const street = String(streetInput ?? '').trim();
  if (!street) return '';
  // 1) Najpierw zdejmujemy końcowe „nr 12", „nr 12a/3", „numer 12".
  let cleaned = street.replace(/\s+(?:nr\.?|numer)\s*\d+[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]?(?:[\/\-]\d+[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]?)?\s*$/iu, '');
  // 2) Następnie czysty końcowy numer typu „12", „5A", „27/29", „23a-15".
  cleaned = cleaned.replace(/\s+\d+[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]?(?:[\/\-]\d+[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż]?)?\s*$/u, '');
  return cleaned.trim();
}

/**
 * Buduje publiczny napis lokalizacji oferty zgodnie z trybem prywatności:
 *  - isExact === true  → "Miasto, Dzielnica • Ulica 12" (pełny adres),
 *  - isExact === false → "Miasto, Dzielnica • Ulica"   (sama nazwa ulicy
 *                                                       bez numeru — kupujący
 *                                                       wie w której ulicy
 *                                                       jest oferta, ale nie
 *                                                       zna dokładnego adresu).
 *
 * Jeśli ulicy nie znamy lub jest pusta — zwracamy `baseLabel` jak dotąd.
 */
export function formatPublicAddress(
  cityInput: unknown,
  districtInput: unknown,
  streetInput: unknown,
  isExactInput: unknown,
  fallback = 'Polska',
): string {
  const baseLabel = formatLocationLabel(cityInput, districtInput, fallback);
  const isExact = resolveIsExactLocation(isExactInput);
  const street = String(streetInput ?? '').trim();
  if (!street) return baseLabel;
  const visibleStreet = isExact ? street : stripHouseNumber(street);
  if (!visibleStreet) return baseLabel;
  return `${baseLabel} • ${visibleStreet}`;
}

export const STRICT_CITIES = [
  'Warszawa',
  'Kraków',
  'Wrocław',
  'Poznań',
  'Łódź',
  'Lublin',
  'Gdańsk',
  'Gdynia',
  'Sopot',
  'Katowice',
  'Rybnik',
  'Białystok',
  'Zamość',
  REST_OF_COUNTRY_CITY,
] as const;

export const STRICT_CITY_DISTRICTS: Record<string, string[]> = {
  Warszawa: ['Bemowo', 'Białołęka', 'Bielany', 'Mokotów', 'Ochota', 'Praga-Południe', 'Praga-Północ', 'Rembertów', 'Śródmieście', 'Targówek', 'Ursus', 'Ursynów', 'Wawer', 'Wesoła', 'Wilanów', 'Włochy', 'Wola', 'Żoliborz'],
  Kraków: ['Stare Miasto', 'Grzegórzki', 'Prądnik Czerwony', 'Prądnik Biały', 'Krowodrza', 'Bronowice', 'Zwierzyniec', 'Dębniki', 'Łagiewniki-Borek Fałęcki', 'Swoszowice', 'Podgórze Duchackie', 'Bieżanów-Prokocim', 'Podgórze', 'Czyżyny', 'Mistrzejowice', 'Bieńczyce', 'Wzgórza Krzesławickie', 'Nowa Huta'],
  Wrocław: ['Stare Miasto', 'Śródmieście', 'Krzyki', 'Fabryczna', 'Psie Pole'],
  Poznań: ['Stare Miasto', 'Nowe Miasto', 'Jeżyce', 'Grunwald', 'Wilda'],
  Łódź: ['Bałuty', 'Górna', 'Polesie', 'Śródmieście', 'Widzew'],
  Lublin: ['Śródmieście', 'Czechów Północny', 'Czechów Południowy', 'Czuby Północne', 'Czuby Południowe', 'LSM', 'Rury', 'Kalinowszczyzna', 'Tatary', 'Bronowice', 'Dziesiąta', 'Wrotków', 'Sławinek', 'Sławin', 'Węglin Północny', 'Węglin Południowy', 'Ponikwoda', 'Hajdów-Zadębie', 'Za Cukrownią', 'Abramowice'],
  Gdańsk: ['Śródmieście', 'Wrzeszcz Górny', 'Wrzeszcz Dolny', 'Oliwa', 'Przymorze Małe', 'Przymorze Wielkie', 'Zaspa-Młyniec', 'Zaspa-Rozstaje', 'Jasień', 'Chełm', 'Ujeścisko-Łostowice', 'Piecki-Migowo', 'Osowa', 'Brzeźno', 'Nowy Port', 'Orunia-Św. Wojciech-Lipce', 'Stogi', 'Żabianka-Wejhera-Jelitkowo-Tysiąclecia'],
  Gdynia: ['Śródmieście', 'Orłowo', 'Redłowo', 'Wzgórze Św. Maksymiliana', 'Działki Leśne', 'Grabówek', 'Chylonia', 'Oksywie', 'Obłuże', 'Karwiny', 'Dąbrowa', 'Wielki Kack', 'Mały Kack', 'Pogórze', 'Cisowa', 'Leszczynki'],
  Sopot: ['Dolny Sopot', 'Górny Sopot', 'Kamienny Potok', 'Brodwino', 'Karlikowo', 'Przylesie', 'Sopot Wyścigi'],
  Katowice: ['Śródmieście', 'Załęże', 'Załęska Hałda-Brynów', 'Osiedle Tysiąclecia', 'Koszutka', 'Bogucice', 'Dąb', 'Ligota-Panewniki', 'Piotrowice-Ochojec', 'Giszowiec', 'Szopienice-Burowiec', 'Murcki', 'Wełnowiec-Józefowiec', 'Janów-Nikiszowiec'],
  Rybnik: ['Śródmieście', 'Boguszowice Osiedle', 'Boguszowice Stare', 'Chwałęcice', 'Chwałowice', 'Golejów', 'Gotartowice', 'Kamień', 'Kłokocin', 'Ligota-Ligocka Kuźnia', 'Meksyk', 'Niedobczyce', 'Niewiadom', 'Ochojec', 'Orzepowice', 'Paruszowiec-Piaski', 'Popielów', 'Radziejów', 'Rybnicka Kuźnia', 'Smolna', 'Stodoły', 'Wielopole', 'Zamysłów', 'Zebrzydowice'],
  Białystok: ['Centrum', 'Białostoczek', 'Bojary', 'Dziesięciny I', 'Dziesięciny II', 'Antoniuk', 'Piaski', 'Przydworcowe', 'Sienkiewicza', 'Młodych', 'Starosielce', 'Nowe Miasto', 'Wysoki Stoczek', 'Zielone Wzgórza', 'Słoneczny Stok', 'Leśna Dolina', 'Bacieczki', 'Jaroszówka', 'Dojlidy', 'Skorupy', 'Zawady'],
  Zamość: ['Stare Miasto', 'Nowe Miasto', 'Planty', 'Janowice', 'Karolówka', 'Promyk', 'Powiatowa', 'Rataja', 'Zamczysko', 'Słoneczny Stok'],
  [REST_OF_COUNTRY_CITY]: [],
};

const cityKeys = Object.keys(STRICT_CITY_DISTRICTS);
const missingInDistrictMap = STRICT_CITIES.filter((city) => !cityKeys.includes(city));
const extraInDistrictMap = cityKeys.filter((city) => !STRICT_CITIES.includes(city as any));
if (missingInDistrictMap.length > 0 || extraInDistrictMap.length > 0) {
  throw new Error(
    `[locationEcosystem] Niespójne miasta/dzielnice. Braki: ${missingInDistrictMap.join(', ') || '-'}; Nadmiarowe: ${extraInDistrictMap.join(', ') || '-'}`
  );
}

Object.freeze(STRICT_CITIES);
cityKeys.forEach((city) => Object.freeze(STRICT_CITY_DISTRICTS[city]));
Object.freeze(STRICT_CITY_DISTRICTS);

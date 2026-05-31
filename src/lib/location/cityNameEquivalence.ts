import { normalizeText } from "@/lib/location/locationCatalog";

/**
 * Grupy nazw tego samego miasta w różnych językach / zapisach.
 * Klucz grupy = pierwszy wpis (ASCII, lowercase po normalizeText).
 */
const CITY_EQUIVALENCE_GROUPS: readonly (readonly string[])[] = [
  ["warsaw", "warszawa"],
  ["krakow", "krakow", "cracow"],
  ["gdansk", "gdansk", "danzig"],
  ["wroclaw", "wroclaw", "breslau"],
  ["poznan", "poznan"],
  ["lodz", "lodz"],
  ["lublin", "lublin"],
  ["katowice", "katowice"],
  ["szczecin", "szczecin", "stettin"],
  ["bydgoszcz", "bydgoszcz"],
  ["bialystok", "bialystok"],
  ["zamosc", "zamosc"],
  ["berlin", "berlin"],
  ["paris", "paryz", "paris"],
  ["madrid", "madryt", "madrid"],
  ["london", "londyn", "london"],
  ["rome", "roma", "rzym"],
  ["milan", "milano", "mediolan"],
  ["naples", "napoli", "neapol"],
  ["florence", "firenze", "florencja"],
  ["venice", "venezia", "wenecja"],
  ["turin", "torino", "turyn"],
  ["munich", "munchen", "monachium"],
  ["frankfurt", "frankfurt"],
  ["hamburg", "hamburg"],
  ["cologne", "koln", "kolonia"],
  ["vienna", "wien", "wieden"],
  ["prague", "praha", "praga"],
  ["bratislava", "bratislava", "bratyslawa"],
  ["budapest", "budapest", "budapeszt"],
  ["bucharest", "bucuresti", "bukareszt"],
  ["sofia", "sofia", "sofia"],
  ["athens", "athens", "ateny"],
  ["lisbon", "lisboa", "lizbona"],
  ["porto", "porto"],
  ["dublin", "dublin", "dublín"],
  ["amsterdam", "amsterdam"],
  ["rotterdam", "rotterdam"],
  ["brussels", "brussels", "bruksela", "bruxelles"],
  ["antwerp", "antwerp", "antwerpia", "anvers"],
  ["zurich", "zurich", "zurych", "zürich"],
  ["geneva", "geneva", "genewa", "genève"],
  ["bern", "bern", "berno"],
  ["copenhagen", "copenhagen", "kobenhavn", "kopenhaga"],
  ["stockholm", "stockholm", "sztokholm"],
  ["oslo", "oslo"],
  ["helsinki", "helsinki", "helsingfors"],
  ["reykjavik", "reykjavik", "reykjavík"],
  ["moscow", "moskwa", "moskva"],
  ["saint petersburg", "st petersburg", "petersburg", "peterburg"],
  ["kyiv", "kiev", "kijow"],
  ["lviv", "lwow"],
  ["minsk", "minsk"],
  ["vilnius", "wilno"],
  ["riga", "ryga"],
  ["tallinn", "tallinn"],
  ["istanbul", "stambul"],
  ["ankara", "ankara"],
  ["tel aviv", "tel aviv", "tel awiw"],
  ["jerusalem", "jerusalem", "jerozolima"],
  ["dubai", "dubai", "dubaj"],
  ["abu dhabi", "abu dhabi"],
  ["doha", "doha"],
  ["riyadh", "riyadh", "rijad"],
  ["cairo", "cairo", "kair"],
  ["casablanca", "casablanca", "casablanca"],
  ["cape town", "cape town", "kapsztad"],
  ["johannesburg", "johannesburg"],
  ["nairobi", "nairobi"],
  ["new york", "new york", "nowy jork"],
  ["los angeles", "los angeles"],
  ["chicago", "chicago"],
  ["miami", "miami"],
  ["san francisco", "san francisco"],
  ["washington", "washington", "waszyngton"],
  ["boston", "boston"],
  ["toronto", "toronto"],
  ["vancouver", "vancouver"],
  ["montreal", "montreal", "montreal"],
  ["mexico city", "mexico city", "meksyk"],
  ["sao paulo", "sao paulo"],
  ["rio de janeiro", "rio de janeiro", "rio"],
  ["buenos aires", "buenos aires"],
  ["santiago", "santiago"],
  ["bogota", "bogota"],
  ["lima", "lima"],
  ["tokyo", "tokyo", "tokio"],
  ["osaka", "osaka"],
  ["seoul", "seoul", "seul"],
  ["beijing", "beijing", "pekin"],
  ["shanghai", "shanghai", "szanghaj"],
  ["hong kong", "hong kong"],
  ["singapore", "singapore", "singapur"],
  ["bangkok", "bangkok"],
  ["jakarta", "jakarta"],
  ["manila", "manila"],
  ["sydney", "sydney", "sidney"],
  ["melbourne", "melbourne"],
  ["auckland", "auckland"],
];

const CITY_GROUP_KEY = new Map<string, string>();

for (const group of CITY_EQUIVALENCE_GROUPS) {
  const key = normalizeText(group[0]);
  for (const alias of group) {
    const norm = normalizeText(alias);
    if (norm) CITY_GROUP_KEY.set(norm, key);
  }
}

/** Kanoniczny klucz do porównań — ten sam dla Paryż / Paris / Paryz. */
export function cityEquivalenceKey(city: string): string {
  const norm = normalizeText(city);
  if (!norm) return "";
  return CITY_GROUP_KEY.get(norm) || norm;
}

/** Czy dwie etykiety opisują to samo miasto (różne języki, odmiany, aliasy). */
export function citiesEquivalent(a: string, b: string): boolean {
  const left = String(a || "").trim();
  const right = String(b || "").trim();
  if (!left || !right) return false;

  const normLeft = normalizeText(left);
  const normRight = normalizeText(right);
  if (normLeft === normRight) return true;

  const keyLeft = cityEquivalenceKey(left);
  const keyRight = cityEquivalenceKey(right);
  if (keyLeft && keyRight && keyLeft === keyRight && CITY_GROUP_KEY.has(normLeft) && CITY_GROUP_KEY.has(normRight)) {
    return true;
  }

  // Częściowe dopasowanie: "Greater London" vs "London"
  if (normLeft.includes(normRight) || normRight.includes(normLeft)) {
    const shorter = normLeft.length <= normRight.length ? normLeft : normRight;
    const longer = normLeft.length > normRight.length ? normLeft : normRight;
    if (shorter.length >= 4 && longer.startsWith(shorter)) return true;
  }

  return false;
}

/** Wszystkie warianty nazwy z jednej etykiety (do porównań krzyżowych). */
export function expandCityLabelVariants(label: string): string[] {
  const norm = normalizeText(label);
  if (!norm) return [];
  const key = CITY_GROUP_KEY.get(norm);
  if (!key) return [label.trim()];
  const variants = new Set<string>([label.trim()]);
  for (const [alias, groupKey] of CITY_GROUP_KEY.entries()) {
    if (groupKey === key) {
      variants.add(alias);
    }
  }
  return [...variants];
}

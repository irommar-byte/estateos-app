/**
 * Prywatność lokalizacji na publicznych ekranach.
 *
 * KONTEKST
 * ────────
 * `isExactLocation === false` ukrywa numer domu w napisie adresowym
 * (`formatPublicAddress`), ale w aplikacji w kilku miejscach (`OfferDetail`,
 * `Step6_Summary`, `RadarHomeScreen`) pokazujemy też ofertę na mapie. Jeśli
 * narysujemy okrąg ~200 m wokół DOKŁADNEGO punktu budynku — środek tarczy
 * zdradza dokładny adres. To luka prywatności, którą trzeba zamknąć.
 *
 * STRATEGIA
 * ─────────
 * Deterministyczny offset (jitter) zaszyty w hash z `offer.id` (albo dowolnego
 * stabilnego stringa-identyfikatora). Cechy:
 *  • dla danej oferty wynik jest ZAWSZE TEN SAM (między sesjami / urządzeniami
 *    / widokami) — nie da się uśrednić wielu obserwacji do prawdziwego punktu,
 *  • offset wynosi 80–170 m w losowym kierunku 0–360°,
 *  • przy okręgu o promieniu 250 m budynek wpada gdzieś WEWNĄTRZ okręgu, ale
 *    nigdy w samym centrum — odbiorca widzi „oferta jest tu w okolicy", ale
 *    nie wie którego budynku dotyczy.
 *
 * KIEDY OBFUSKOWAĆ
 * ────────────────
 *  • `isExactLocation === false`,
 *  • PRZED rysowaniem mapy dla anonimowego widza (`viewerIsOwner === false`).
 *
 * Właściciel / partner / admin zawsze dostaje surowe współrzędne — żeby mógł
 * zweryfikować, że pin stoi gdzie trzeba.
 */

const EARTH_R = 6378137; // promień Ziemi w metrach

/**
 * Mały, niekryptograficzny hash 32-bitowy. Wystarcza, bo nie chronimy tajemnic
 * państwowych — chcemy tylko deterministycznego, równomiernie rozproszonego
 * rezultatu z `offer.id` (lub innego stabilnego klucza).
 */
function hash32(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Zwracamy nieujemną liczbę.
  return h >>> 0;
}

/**
 * Deterministyczny offset w metrach + kąt (radiany) z `offer.id`.
 * 80–170 m daje wystarczający „shake", a jednocześnie budynek wciąż mieści
 * się w okręgu ochronnym 250 m.
 */
function deterministicOffset(salt: string): { distM: number; angle: number } {
  const h = hash32(`offer:${salt}`);
  // Wyciągamy dwa „kanały" pseudo-losowości z różnych bitów hash-a.
  const a = (h & 0xffff) / 0xffff; // 0..1 — kąt
  const b = ((h >>> 16) & 0xffff) / 0xffff; // 0..1 — promień
  const distM = 80 + Math.round(b * 90); // 80..170 m
  const angle = a * Math.PI * 2;
  return { distM, angle };
}

/**
 * Przesuwa lat/lng o zadany offset (m, kąt rad). Aproksymacja płaskiego
 * lokalnego obszaru — dla 80–170 m błąd jest pomijalny (<1 m).
 */
function offsetCoords(lat: number, lng: number, distM: number, angle: number): { lat: number; lng: number } {
  const dLat = (distM * Math.cos(angle)) / EARTH_R;
  const dLng = (distM * Math.sin(angle)) / (EARTH_R * Math.cos((lat * Math.PI) / 180));
  return {
    lat: lat + (dLat * 180) / Math.PI,
    lng: lng + (dLng * 180) / Math.PI,
  };
}

/**
 * Zwraca współrzędne, które WOLNO pokazać anonimowemu widzowi.
 * Gdy ofiara prywatności nie jest aktywna (`!hideExact`) — zwraca surowe lat/lng.
 */
export function obfuscatePublicCoords(
  lat: number,
  lng: number,
  salt: string | number | null | undefined,
  hideExact: boolean,
): { lat: number; lng: number; obfuscated: boolean } {
  if (!hideExact) return { lat, lng, obfuscated: false };
  const key = String(salt ?? `${lat.toFixed(5)}:${lng.toFixed(5)}`);
  const { distM, angle } = deterministicOffset(key);
  const off = offsetCoords(lat, lng, distM, angle);
  return { lat: off.lat, lng: off.lng, obfuscated: true };
}

/**
 * Wysokopoziomowy helper do publicznych map: zwraca gotową prezentację
 * (centerLat/Lng, tryb pin/circle, promień, delta dla `region`).
 *
 *  • `viewerIsOwner === true` — pełny dostęp, dokładny pin nawet przy
 *    `isExactLocation === false` (właściciel sam ustawia widoczność).
 *  • inaczej, `isExactLocation === false` — circle ~250 m wokół
 *    zjitterowanego środka, szeroki zoom.
 *  • `isExactLocation === true` — exact pin, normalny zoom.
 */
export function getPublicMapPresentation(args: {
  lat: number;
  lng: number;
  offerId: string | number | null | undefined;
  isExactLocation: boolean;
  viewerIsOwner?: boolean;
}): {
  latitude: number;
  longitude: number;
  mode: 'pin' | 'circle';
  circleRadiusM: number;
  latitudeDelta: number;
  longitudeDelta: number;
  obfuscated: boolean;
} {
  const showExact = args.isExactLocation || !!args.viewerIsOwner;
  const obfusc = obfuscatePublicCoords(args.lat, args.lng, args.offerId, !showExact);
  if (showExact) {
    return {
      latitude: obfusc.lat,
      longitude: obfusc.lng,
      mode: 'pin',
      circleRadiusM: 0,
      latitudeDelta: 0.015,
      longitudeDelta: 0.015,
      obfuscated: false,
    };
  }
  return {
    latitude: obfusc.lat,
    longitude: obfusc.lng,
    mode: 'circle',
    circleRadiusM: 250,
    latitudeDelta: 0.018,
    longitudeDelta: 0.018,
    obfuscated: true,
  };
}

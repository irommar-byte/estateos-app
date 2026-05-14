/**
 * ====================================================================
 *  EstateOS™ — Cykl życia oferty: pojedyncze źródło prawdy
 * ====================================================================
 *
 *  Backend (a wcześniej DB) potrafi zwracać status w kilku konwencjach:
 *  UPPERCASE, lowercase, ze spacjami zamiast podkreśleń, w polach
 *  `status` / `state` / `lifecycleStatus`. Dodatkowo „nieaktualność"
 *  można poznać po wygaśnięciu `expiresAt` lub po sfinalizowanej
 *  transakcji w dealroomie.
 *
 *  Cały „czy oferta jest zamknięta" liczymy TU, w jednym miejscu,
 *  żeby wszystkie ekrany (OfferDetail, ProfileScreen, EstateDiscovery,
 *  AddOffer, EditOfferScreen, ...) miały spójną odpowiedź — bez tego
 *  rozjazdy w UI są nieuniknione (jeden ekran blokuje, drugi nie).
 *
 *  Stany finalne (zamykające możliwość kontaktu z właścicielem):
 *    • ARCHIVED  — właściciel ręcznie wycofał ofertę
 *    • SOLD      — sprzedaż zakończona (po stronie dealroom finalize)
 *    • CLOSED    — uniwersalne „zamknięte" z back-endu
 *    • REJECTED  — odrzucona przez moderację
 *    • EXPIRED   — wygasła z czasu publikacji
 *    • INACTIVE  — wyłączona z innego powodu
 *    • CANCELLED/CANCELED — anulowana
 *    • OFF_MARKET — wycofana z rynku (synonim ARCHIVED)
 *    • FINALIZED/COMPLETED/DONE — synonimy SOLD po stronie deala
 *
 *  PENDING (jeszcze nie akceptowana przez moderację) NIE jest „zamknięta"
 *  z punktu widzenia tej funkcji — co prawda nie powinna być publicznie
 *  widoczna, ale jeśli ktoś już ma link, to nie chcemy go zwodzić, że
 *  „nieaktualna". Tę cechę traktuje się osobno (np. komunikatem
 *  „W weryfikacji").
 */

type AnyObj = Record<string, any>;

export type OfferLifecycleReason = 'ARCHIVED' | 'SOLD' | 'EXPIRED' | 'REJECTED' | 'INACTIVE' | 'UNKNOWN_CLOSED';

export type OfferLifecycleState =
  | { isClosed: false; isPending: boolean; rawStatus: string }
  | {
      isClosed: true;
      isPending: false;
      rawStatus: string;
      reason: OfferLifecycleReason;
      /** Krótki nagłówek do zaślepki, np. „Oferta sprzedana". */
      headline: string;
      /** Drobniejszy opis pod nagłówkiem (zachowuje godność, bez clickbaitu). */
      subline: string;
    };

/**
 * Mapa kanoniczna — wszystkie aliasy zwijają się do jednego stanu.
 * Każdy wpis ma `reason` (kategoria dla UI) oraz default `headline/subline`.
 */
const CLOSED_STATUS_MAP: Record<string, { reason: OfferLifecycleReason; headline: string; subline: string }> = {
  ARCHIVED: {
    reason: 'ARCHIVED',
    headline: 'Oferta zakończona',
    subline: 'Właściciel wycofał tę ofertę. Kontakt i propozycje są zablokowane.',
  },
  CLOSED: {
    reason: 'ARCHIVED',
    headline: 'Oferta zakończona',
    subline: 'Ta oferta nie jest już dostępna na rynku.',
  },
  OFF_MARKET: {
    reason: 'ARCHIVED',
    headline: 'Oferta wycofana z rynku',
    subline: 'Aktualnie ta nieruchomość nie jest oferowana do sprzedaży lub najmu.',
  },
  SOLD: {
    reason: 'SOLD',
    headline: 'Nieruchomość sprzedana',
    subline: 'Transakcja została sfinalizowana — oferta nie jest już dostępna.',
  },
  FINALIZED: {
    reason: 'SOLD',
    headline: 'Transakcja sfinalizowana',
    subline: 'Sprzedaż została zamknięta. Oferta trafiła do archiwum.',
  },
  COMPLETED: {
    reason: 'SOLD',
    headline: 'Transakcja zamknięta',
    subline: 'Oferta nie jest już dostępna — proces został zakończony.',
  },
  DONE: {
    reason: 'SOLD',
    headline: 'Transakcja zamknięta',
    subline: 'Oferta nie jest już dostępna — proces został zakończony.',
  },
  EXPIRED: {
    reason: 'EXPIRED',
    headline: 'Oferta nieaktualna',
    subline: 'Czas publikacji tej oferty się skończył. Skontaktuj się z innymi ofertami z Radaru.',
  },
  REJECTED: {
    reason: 'REJECTED',
    headline: 'Oferta odrzucona',
    subline: 'Ta oferta nie przeszła weryfikacji moderatora i nie jest dostępna publicznie.',
  },
  INACTIVE: {
    reason: 'INACTIVE',
    headline: 'Oferta nieaktywna',
    subline: 'Właściciel tymczasowo wyłączył tę ofertę z prezentacji.',
  },
  CANCELLED: {
    reason: 'INACTIVE',
    headline: 'Oferta anulowana',
    subline: 'Oferta została anulowana i nie jest już dostępna.',
  },
  CANCELED: {
    reason: 'INACTIVE',
    headline: 'Oferta anulowana',
    subline: 'Oferta została anulowana i nie jest już dostępna.',
  },
};

const PENDING_STATUSES = new Set(['PENDING', 'DRAFT', 'WAITING', 'UNDER_REVIEW', 'REVIEW', 'IN_REVIEW', 'NEW']);

function normalize(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
}

/**
 * Zwraca aktualny stan oferty z perspektywy „czy można z nią cokolwiek
 * robić". Funkcja jest CZYSTA — nie czyta `Date.now()` poza miejscem,
 * w którym sprawdzamy `expiresAt` (i nawet to można pominąć przez
 * przekazanie `now` parametrem, np. w testach).
 */
export function getOfferLifecycleState(offer: AnyObj | null | undefined, now: number = Date.now()): OfferLifecycleState {
  if (!offer || typeof offer !== 'object') {
    return { isClosed: false, isPending: false, rawStatus: '' };
  }

  // Pole statusu — backend bywa niespójny, więc patrzymy w 4 popularne
  // klucze i bierzemy pierwszy niepusty.
  const statusRaw = normalize(
    offer.status ?? offer.state ?? offer.lifecycleStatus ?? offer.offerStatus ?? '',
  );

  // Jeśli backend dorzuca semantyczne flagi — honorujemy je z najwyższym
  // priorytetem. To pozwala API w przyszłości zwracać `isArchived: true`
  // bez konieczności zmiany aliasów statusu.
  const explicitlyArchived = offer.isArchived === true || offer.archived === true;
  const explicitlySold = offer.isSold === true || offer.sold === true;
  const explicitlyExpired = offer.isExpired === true || offer.expired === true;

  if (explicitlySold) {
    return wrapClosed('SOLD', CLOSED_STATUS_MAP.SOLD);
  }
  if (explicitlyArchived) {
    return wrapClosed(statusRaw || 'ARCHIVED', CLOSED_STATUS_MAP.ARCHIVED);
  }
  if (explicitlyExpired) {
    return wrapClosed(statusRaw || 'EXPIRED', CLOSED_STATUS_MAP.EXPIRED);
  }

  // Klucz: czy status wskazuje stan zamknięty?
  if (statusRaw && CLOSED_STATUS_MAP[statusRaw]) {
    return wrapClosed(statusRaw, CLOSED_STATUS_MAP[statusRaw]);
  }

  // Wygaśnięcie po dacie — `expiresAt` / `validUntil` / `publishedUntil`.
  // Jeśli którekolwiek pole jest w przeszłości, traktujemy jako EXPIRED.
  const expiryCandidates = [offer.expiresAt, offer.validUntil, offer.publishedUntil, offer.expirationDate, offer.expireAt];
  for (const raw of expiryCandidates) {
    if (!raw) continue;
    const ts = new Date(String(raw)).getTime();
    if (Number.isFinite(ts) && ts > 0 && ts < now) {
      return wrapClosed('EXPIRED', CLOSED_STATUS_MAP.EXPIRED);
    }
  }

  const isPending = PENDING_STATUSES.has(statusRaw);
  return { isClosed: false, isPending, rawStatus: statusRaw };
}

function wrapClosed(
  rawStatus: string,
  meta: { reason: OfferLifecycleReason; headline: string; subline: string },
): OfferLifecycleState {
  return {
    isClosed: true,
    isPending: false,
    rawStatus,
    reason: meta.reason,
    headline: meta.headline,
    subline: meta.subline,
  };
}

/** Pomocniczy bool dla call-site'ów, którym wystarczy „closed czy nie". */
export function isOfferClosed(offer: AnyObj | null | undefined, now: number = Date.now()): boolean {
  return getOfferLifecycleState(offer, now).isClosed;
}

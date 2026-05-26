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

import { t } from '../i18n';

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

type ClosedMeta = { reason: OfferLifecycleReason; headlineKey: string; sublineKey: string };

/**
 * Mapa kanoniczna — wszystkie aliasy zwijają się do jednego stanu.
 * Każdy wpis ma `reason` (kategoria dla UI) oraz klucze tłumaczeń headline/subline.
 */
const CLOSED_STATUS_MAP: Record<string, ClosedMeta> = {
  ARCHIVED: {
    reason: 'ARCHIVED',
    headlineKey: 'offer.lifecycle.archived.headline',
    sublineKey: 'offer.lifecycle.archived.subline',
  },
  CLOSED: {
    reason: 'ARCHIVED',
    headlineKey: 'offer.lifecycle.closed.headline',
    sublineKey: 'offer.lifecycle.closed.subline',
  },
  OFF_MARKET: {
    reason: 'ARCHIVED',
    headlineKey: 'offer.lifecycle.offMarket.headline',
    sublineKey: 'offer.lifecycle.offMarket.subline',
  },
  SOLD: {
    reason: 'SOLD',
    headlineKey: 'offer.lifecycle.sold.headline',
    sublineKey: 'offer.lifecycle.sold.subline',
  },
  FINALIZED: {
    reason: 'SOLD',
    headlineKey: 'offer.lifecycle.finalized.headline',
    sublineKey: 'offer.lifecycle.finalized.subline',
  },
  COMPLETED: {
    reason: 'SOLD',
    headlineKey: 'offer.lifecycle.completed.headline',
    sublineKey: 'offer.lifecycle.completed.subline',
  },
  DONE: {
    reason: 'SOLD',
    headlineKey: 'offer.lifecycle.done.headline',
    sublineKey: 'offer.lifecycle.done.subline',
  },
  EXPIRED: {
    reason: 'EXPIRED',
    headlineKey: 'offer.lifecycle.expired.headline',
    sublineKey: 'offer.lifecycle.expired.subline',
  },
  REJECTED: {
    reason: 'REJECTED',
    headlineKey: 'offer.lifecycle.rejected.headline',
    sublineKey: 'offer.lifecycle.rejected.subline',
  },
  INACTIVE: {
    reason: 'INACTIVE',
    headlineKey: 'offer.lifecycle.inactive.headline',
    sublineKey: 'offer.lifecycle.inactive.subline',
  },
  CANCELLED: {
    reason: 'INACTIVE',
    headlineKey: 'offer.lifecycle.cancelled.headline',
    sublineKey: 'offer.lifecycle.cancelled.subline',
  },
  CANCELED: {
    reason: 'INACTIVE',
    headlineKey: 'offer.lifecycle.canceled.headline',
    sublineKey: 'offer.lifecycle.canceled.subline',
  },
};

const PENDING_STATUSES = new Set(['PENDING', 'DRAFT', 'WAITING', 'UNDER_REVIEW', 'REVIEW', 'IN_REVIEW', 'NEW']);

function normalize(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
}

function resolveClosedCopy(meta: ClosedMeta): { reason: OfferLifecycleReason; headline: string; subline: string } {
  return {
    reason: meta.reason,
    headline: t(meta.headlineKey),
    subline: t(meta.sublineKey),
  };
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

  const statusRaw = normalize(
    offer.status ?? offer.state ?? offer.lifecycleStatus ?? offer.offerStatus ?? '',
  );

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

  if (statusRaw && CLOSED_STATUS_MAP[statusRaw]) {
    return wrapClosed(statusRaw, CLOSED_STATUS_MAP[statusRaw]);
  }

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

function wrapClosed(rawStatus: string, meta: ClosedMeta): OfferLifecycleState {
  const copy = resolveClosedCopy(meta);
  return {
    isClosed: true,
    isPending: false,
    rawStatus,
    ...copy,
  };
}

/** Pomocniczy bool dla call-site'ów, którym wystarczy „closed czy nie". */
export function isOfferClosed(offer: AnyObj | null | undefined, now: number = Date.now()): boolean {
  return getOfferLifecycleState(offer, now).isClosed;
}

/** Okno „NOWA OFERTA" od momentu aktywacji na rynku. */
export const OFFER_NEW_LISTING_WINDOW_MS = 48 * 60 * 60 * 1000;

/** Najlepszy dostępny timestamp aktywacji / publikacji oferty. */
export function resolveOfferActivationMs(offer: AnyObj | null | undefined): number | null {
  if (!offer || typeof offer !== 'object') return null;
  const candidates = [
    offer.activatedAt,
    offer.publishedAt,
    offer.activeAt,
    offer.statusChangedAt,
    offer.promotedAt,
    offer.createdAt,
    offer.updatedAt,
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    const ms = new Date(String(raw)).getTime();
    if (Number.isFinite(ms) && ms > 0) return ms;
  }
  return null;
}

/** Oferta aktywna na rynku nie dłużej niż 48 h — badge „NOWA OFERTA". */
export function isOfferNewListing(offer: AnyObj | null | undefined, now: number = Date.now()): boolean {
  if (!offer || typeof offer !== 'object') return false;
  const status = normalize(offer.status ?? offer.state ?? '');
  if (status && status !== 'ACTIVE') return false;
  const activatedMs = resolveOfferActivationMs(offer);
  if (!activatedMs) return false;
  return now - activatedMs <= OFFER_NEW_LISTING_WINDOW_MS;
}

/**
 * Wspólny helper dla logiki prowizji agenta przy ofercie EstateOS™.
 *
 * Wymagania biznesowe (uzgodnione 2026-05-11, doprecyzowane 2026-05-12):
 *  • Tylko user z rolą `AGENT` (mobile) może DODAĆ prowizję przy wystawianiu oferty.
 *  • Klient kupujący widzi DOKŁADNIE TĘ SAMĄ cenę ofertową, co u oferty prywatnej —
 *    NIC nie jest doliczane. Adnotacja informuje, że z tej ceny `X%` stanowi
 *    prowizję agenta, którą po finalizacji transakcji kupujący opłaca AGENTOWI
 *    BEZPOŚREDNIO (poza platformą), zgodnie z umową pośrednictwa.
 *  • PROWIZJA JEST BRUTTO — kwota policzona z `X%` ceny ofertowej zawiera już
 *    VAT i wszelkie podatki. Kupujący NIE dopłaca żadnego podatku ani opłat
 *    dodatkowych ponad tę kwotę. Tekst „Kwota jest BRUTTO" pojawia się
 *    równolegle w UI: Step4_Finance, Step6_Summary, EditOfferScreen oraz
 *    pigułce w OfferDetail (widok kupującego).
 *  • Pinezki na mapie: zielone = sprzedaż, niebieskie = wynajem (bez wyjątku
 *    dla agenta; osobny kolor partnera — w późniejszej iteracji).
 *
 * Walidacja: 0% (bez prowizji) albo od 0,5% w górę — bez górnego limitu procentu.
 */

import { resolveOfferListingPrice } from '../money/offerPrice';
import { formatOfferSecondaryAmount } from '../money/format';
import type { DisplayCurrencyPreference } from '../money/types';

/**
 * Minimalna NIEZEROWA prowizja — chroni przed literówkami typu "0,1".
 * Wartość `0` (zero) jest dozwolona OSOBNO jako tryb „Bez prowizji" — patrz
 * `isZeroCommission()` poniżej. Nielegalny jest dopiero zakres `(0, 0.5)`.
 */
export const AGENT_COMMISSION_MIN_PERCENT = 0.5;
/** Brak górnego limitu — agent wpisuje dowolną prowizję rynkową. */
export const AGENT_COMMISSION_MAX_PERCENT = Number.POSITIVE_INFINITY;
/** Krok stepperów +/- w UI (np. Step4_Finance). */
export const AGENT_COMMISSION_STEP_PERCENT = 0.25;
/** Wartość domyślna pre-fillowana, gdy agent włącza pole pierwszy raz. */
export const AGENT_COMMISSION_DEFAULT_PERCENT = 2.5;
/**
 * Legalna „twarda" wartość 0% — oznacza, że agent świadomie wystawia ofertę
 * **bez prowizji** (np. własna nieruchomość, polecenie). UI maluje wtedy
 * kartę / pigułkę na zielono i informuje kupującego, że nic nie dopłaca.
 */
export const AGENT_COMMISSION_ZERO_PERCENT = 0;

export type AgentCommissionValidationError =
  | 'EMPTY'
  | 'INVALID_NUMBER'
  | 'OUT_OF_RANGE';

export type AgentCommissionValidation =
  | { ok: true; percent: number }
  | { ok: false; errorCode: AgentCommissionValidationError; message: string };

/**
 * Parsuje surowy input (string z TextInput albo number z backendu) na liczbę
 * procent. Akceptuje przecinek i kropkę. Zwraca `null` gdy puste / niepoprawne —
 * NIE rzuca i NIE waliduje zakresu (to robi `validateAgentCommissionPercent`).
 */
export function parseAgentCommissionPercent(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null;
    return raw;
  }
  const trimmed = String(raw).trim().replace(',', '.');
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

/** Czy użytkownik w trakcie wpisywania (nie parsujemy na siłę). */
export function isIncompleteCommissionPercentDraft(raw: unknown): boolean {
  const s = String(raw ?? '').trim();
  if (!s) return false;
  if (/[,.]$/.test(s)) return true;
  if (/^[,.]/.test(s)) return true;
  return false;
}

/** Podgląd procentu podczas edycji — bez zaokrąglenia i bez „skoków”. */
export function previewPercentFromAmountDraft(priceRaw: unknown, amountRaw: unknown): number | null {
  const price = parseOfferNumeric(priceRaw);
  const amount = parseOfferNumeric(amountRaw);
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(amount) || amount < 0) return null;
  if (amount === 0) return 0;
  return (amount / price) * 100;
}

/** Podgląd kwoty PLN z wpisywanego procentu (także „2,” → 2%). */
export function previewAmountFromPercentDraft(priceRaw: unknown, percentRaw: unknown): number {
  if (isIncompleteCommissionPercentDraft(percentRaw)) {
    const s = String(percentRaw ?? '').trim();
    const prefix = s.replace(/[,.]$/, '').replace(',', '.');
    if (!prefix || /^[,.]/.test(prefix)) return 0;
    const p = Number(prefix);
    if (!Number.isFinite(p)) return 0;
    return computeAgentCommissionAmount(priceRaw, p);
  }
  const p = parseAgentCommissionPercent(percentRaw);
  return computeAgentCommissionAmount(priceRaw, p);
}

/** Czy pokazywać ostrzeżenie o zakresie (nie w trakcie edycji pola). */
export function shouldWarnCommissionPercentDraft(
  raw: unknown,
  options?: { isFocused?: boolean },
): boolean {
  if (options?.isFocused) return false;
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return false;
  if (isIncompleteCommissionPercentDraft(raw)) return false;
  const parsed = parseAgentCommissionPercent(raw);
  if (parsed === null) return true;
  if (parsed === 0) return false;
  return parsed < AGENT_COMMISSION_MIN_PERCENT;
}

/**
 * Pełna walidacja procentowej prowizji do zapisania w bazie.
 * Wywołaj DOPIERO przy submitcie / przed POSTem do `/api/mobile/v1/offers`.
 *
 * Reguły:
 *   • `0` (twarde zero) — OK, tryb „Bez prowizji" (kupujący nic nie dopłaca).
 *   • `[0.5, 10]` — standardowa prowizja, snap do 0.25%.
 *   • `(0, 0.5)` — odrzucone jako OUT_OF_RANGE (literówka).
 *   • `> 10` — odrzucone jako OUT_OF_RANGE.
 */
export function validateAgentCommissionPercent(raw: unknown): AgentCommissionValidation {
  const parsed = parseAgentCommissionPercent(raw);
  if (parsed === null) {
    if (raw === null || raw === undefined || String(raw).trim() === '') {
      return { ok: false, errorCode: 'EMPTY', message: 'Podaj swoją prowizję (procent).' };
    }
    return { ok: false, errorCode: 'INVALID_NUMBER', message: 'Prowizja musi być liczbą.' };
  }
  if (parsed === AGENT_COMMISSION_ZERO_PERCENT) {
    return { ok: true, percent: 0 };
  }
  if (parsed < AGENT_COMMISSION_MIN_PERCENT) {
    return {
      ok: false,
      errorCode: 'OUT_OF_RANGE',
      message: `Prowizja agenta: 0% (bez prowizji) albo co najmniej ${formatPercentLabel(
        AGENT_COMMISSION_MIN_PERCENT,
      )} ceny ofertowej.`,
    };
  }
  return { ok: true, percent: Math.round(parsed * 10000) / 10000 };
}

/** Czy wartość procentu to świadome „0%" (a nie brak / null)? */
export function isZeroCommissionPercent(percent: number | null | undefined): boolean {
  return percent !== null && percent !== undefined && Number.isFinite(percent) && percent === 0;
}

/** Zaokrąglenie do 0.25 — krok stepperów. */
export function roundToQuarter(value: number): number {
  return Math.round(value * 4) / 4;
}

/**
 * Cena / metraż z API: liczba albo string ze spacjami tysięcy, NBSP lub przecinkiem dziesiętnym.
 */
export function parseOfferNumeric(raw: unknown): number {
  if (raw === null || raw === undefined || raw === '') return NaN;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : NaN;
  const s = String(raw)
    .replace(/\u00a0/g, '')
    .replace(/\s/g, '')
    .replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Wylicza kwotę prowizji (PLN) na podstawie ceny ofertowej i procentu.
 * Cena może być stringiem (np. "650 000") lub liczbą — zawsze zwraca liczbę całkowitą PLN.
 * Brak / 0 → 0.
 */
export type AgentCommissionInputMode = 'percent' | 'amount';

export function maxAgentCommissionAmountPln(priceRaw: unknown): number {
  if (!Number.isFinite(AGENT_COMMISSION_MAX_PERCENT)) return Number.NaN;
  return computeAgentCommissionAmount(priceRaw, AGENT_COMMISSION_MAX_PERCENT);
}

export function percentFromCommissionAmount(
  priceRaw: unknown,
  amountRaw: unknown,
  options?: { clampToMax?: boolean },
): number | null {
  const price = parseOfferNumeric(priceRaw);
  const amount = parseOfferNumeric(amountRaw);
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(amount) || amount < 0) return null;
  if (amount === 0) return 0;
  let percent = (amount / price) * 100;
  if (
    options?.clampToMax &&
    Number.isFinite(AGENT_COMMISSION_MAX_PERCENT) &&
    percent > AGENT_COMMISSION_MAX_PERCENT
  ) {
    percent = AGENT_COMMISSION_MAX_PERCENT;
  }
  return Math.round(percent * 10000) / 10000;
}

/** Z kwoty PLN → procent + opcjonalnie przycięta kwota (gdy > 10%). */
export function commissionAmountInputToPercent(
  priceRaw: unknown,
  amountRaw: unknown,
): { percent: number; amountPln: number } | null {
  const price = parseOfferNumeric(priceRaw);
  let amount = parseOfferNumeric(amountRaw);
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(amount) || amount < 0) return null;
  const percent = percentFromCommissionAmount(price, amount);
  if (percent === null) return null;
  return { percent, amountPln: Math.round(amount) };
}

export function resolveAgentCommissionPercentForSave(opts: {
  mode: AgentCommissionInputMode;
  percentRaw: unknown;
  amountRaw: unknown;
  priceRaw: unknown;
}): AgentCommissionValidation {
  if (opts.mode === 'amount') {
    const synced = commissionAmountInputToPercent(opts.priceRaw, opts.amountRaw);
    if (synced === null) {
      return { ok: false, errorCode: 'INVALID_NUMBER', message: 'Podaj kwotę prowizji i cenę oferty.' };
    }
    return validateAgentCommissionPercent(synced.percent);
  }
  return validateAgentCommissionPercent(opts.percentRaw);
}

export function computeAgentCommissionAmount(priceRaw: unknown, percent: number | null): number {
  if (percent === null || !Number.isFinite(percent)) return 0;
  const priceNum =
    typeof priceRaw === 'number'
      ? Number.isFinite(priceRaw)
        ? priceRaw
        : NaN
      : parseOfferNumeric(priceRaw);
  if (!Number.isFinite(priceNum) || priceNum <= 0) return 0;
  return Math.round((priceNum * percent) / 100);
}

/** "2,5%" / "10%" / "0%" — z polskim przecinkiem. */
export function formatPercentLabel(percent: number): string {
  if (!Number.isFinite(percent)) return '—';
  if (percent === 0) return '0%';
  const rounded = roundToQuarter(percent);
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0$/, '').replace(/\.$/, '');
  return `${text.replace('.', ',')}%`;
}

/** "18 000 PLN" — z twardą spacją (NBSP) dla tysięcy. */
export function formatPlnAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '0 PLN';
  return `${Math.round(amount).toLocaleString('pl-PL')} PLN`;
}

export function formatCommissionAmountForDisplay(
  amount: number,
  offerRaw: unknown,
  priceRaw: unknown,
  preference: DisplayCurrencyPreference,
  rate: number,
): string {
  if (!Number.isFinite(amount) || amount <= 0) {
    return preference === 'EUR' ? '0 €' : '0 zł';
  }
  const listing = resolveOfferListingPrice(offerRaw ?? { price: priceRaw }, rate);
  const priceNum = parseOfferNumeric(priceRaw ?? (offerRaw as Record<string, unknown>)?.price);
  const commissionPln =
    listing.plnAmount > 0 && Number.isFinite(priceNum) && priceNum > 0
      ? Math.round((listing.plnAmount * amount) / priceNum)
      : null;
  return formatOfferSecondaryAmount({
    amount,
    listingCurrency: listing.currency,
    pricePln: commissionPln,
    displayPreference: preference,
    rate,
  });
}

/**
 * Kanoniczna detekcja "czy oferta jest od agenta" — uwzględnia:
 *  • nową rolę mobile `AGENT`,
 *  • legacy WWW partnera (`planType=AGENCY`, `role=PARTNER`),
 *  • flagi `isPartner` / `isAgency` z różnych warstw API.
 *
 * Używana przez Radar (pomarańczowy pin) i OfferDetail (pigułka prowizji).
 */
export function isAgentOfferRaw(raw: any): boolean {
  if (!raw || typeof raw !== 'object') return false;
  /** Zapisana prowizja = oferta agentska nawet gdy feed nie powiela `ownerRole`. */
  if (extractAgentCommissionPercent(raw) !== null) return true;
  if (
    raw.isPartner === true ||
    raw.partner === true ||
    raw.isAgency === true ||
    raw.agency === true ||
    raw.isProAgency === true ||
    raw.isAgent === true
  ) {
    return true;
  }
  const candidates = [
    raw.role,
    raw.userRole,
    raw.ownerRole,
    raw.publisherRole,
    raw.accountType,
    raw.planType,
    raw.type,
    raw.source,
    raw.listingSource,
    raw.authorType,
    raw.user?.role,
    raw.owner?.role,
    raw.seller?.role,
    raw.user?.planType,
    raw.owner?.planType,
    raw.seller?.planType,
  ]
    .map((v) => String(v || '').toUpperCase())
    .filter(Boolean);

  return candidates.some(
    (v) => v === 'AGENT' || v.includes('PARTNER') || v.includes('AGENCY'),
  );
}

/** Wyłącznie nowa rola mobile — czyli czy ZALOGOWANY user jest agentem. */
export function isMobileAgentRole(role: unknown): boolean {
  return String(role || '').toUpperCase() === 'AGENT';
}

/**
 * Czy konto może ustawiać prowizję przy ofercie (pole w kroku finansów / API).
 * Oprócz jawnego `role === 'AGENT'` uwzględnia legacy / web: plan agencji,
 * flagi partnera — tak jak `isAgentOfferRaw`, ale na obiekcie użytkownika z `/me`.
 */
export function isAgentCommissionAccount(user: unknown): boolean {
  if (!user || typeof user !== 'object') return false;
  const u = user as Record<string, unknown>;
  if (isMobileAgentRole(u.role)) return true;
  const roleU = String(u.role ?? '')
    .toUpperCase()
    .replace(/\s+/g, '');
  if (roleU.includes('PARTNER')) return true;
  const pt = String(u.planType ?? '')
    .toUpperCase()
    .replace(/\s+/g, '');
  if (pt.includes('AGENCY')) return true;
  if (u.isPartner === true || u.isAgency === true || u.partner === true || u.agency === true) return true;
  return false;
}

/**
 * Wybiera procent prowizji z surowej oferty (różne nazwy z backendu).
 * Zwraca `null` jeśli brak / niepoprawne — wtedy UI nie pokazuje pigułki.
 * Zwraca `0` świadomie, gdy agent oznaczył ofertę jako „Bez prowizji".
 */
export function extractAgentCommissionPercent(raw: any): number | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidates = [
    raw.agentCommissionPercent,
    raw.agent_commission_percent,
    raw.commissionPercent,
    raw.commission_percent,
    raw.agencyCommissionPercent,
    raw.agency_commission_percent,
  ];
  for (const c of candidates) {
    if (c === null || c === undefined || String(c).trim() === '') continue;
    const parsed = parseAgentCommissionPercent(c);
    if (parsed !== null && parsed >= 0) return parsed;
  }
  return null;
}

/**
 * Pełen, gotowy do wyświetlenia opis prowizji agenta dla oferty.
 * Zwraca `null` gdy brak zapisanej prowizji lub brak ceny do wyliczenia kwoty (dla % > 0).
 *
 * Nie wymagamy `isAgentOfferRaw` — wystarczy niepusty `agentCommissionPercent` z API
 * (backend zapisuje go tylko dla kont agenta).
 *
 * `isZero === true` → tryb „Bez prowizji" (zielony akcent w UI).
 * `isZero === false` → standardowa prowizja, kwota w `amount`.
 */
export function describeOfferAgentCommission(raw: any, priceRaw: unknown): {
  percent: number;
  amount: number;
  percentLabel: string;
  amountLabel: string;
  companyName: string | null;
  isZero: boolean;
} | null {
  if (!raw || typeof raw !== 'object') return null;
  const percent = extractAgentCommissionPercent(raw);
  if (percent === null) return null;
  const isZero = isZeroCommissionPercent(percent);
  const priceNum = parseOfferNumeric(priceRaw ?? raw?.price);
  const priceOk = Number.isFinite(priceNum) && priceNum > 0;
  if (!isZero && !priceOk) return null;

  const amount = isZero ? 0 : computeAgentCommissionAmount(priceRaw ?? raw?.price, percent);
  const amountLabel = isZero
    ? formatPlnAmount(0)
    : amount < 1
      ? '< 1 PLN'
      : formatPlnAmount(amount);

  const companyName =
    raw.companyName ||
    raw.company_name ||
    raw.user?.companyName ||
    raw.owner?.companyName ||
    raw.seller?.companyName ||
    null;
  return {
    percent,
    amount,
    percentLabel: formatPercentLabel(percent),
    amountLabel,
    companyName: companyName ? String(companyName).trim() : null,
    isZero,
  };
}

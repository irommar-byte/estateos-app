export type LeadTransferStatus =
  | 'PENDING'
  | 'TERMS_PROPOSED'
  | 'USER_COUNTER'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'COUNTERED';

export const LEAD_CONDITION_CATALOG = [
  { id: 'valuation', label: 'Wycena rynkowa i rekomendacja ceny wyjściowej' },
  { id: 'photos', label: 'Profesjonalna sesja zdjęciowa i wirtualny spacer' },
  { id: 'marketing', label: 'Publikacja i promocja ogłoszenia na platformach' },
  { id: 'inquiries', label: 'Obsługa zapytań i wstępna kwalifikacja kupujących' },
  { id: 'visits', label: 'Umawianie i prowadzenie prezentacji nieruchomości' },
  { id: 'negotiations', label: 'Negocjacje cenowe i warunków transakcji' },
  { id: 'legal', label: 'Koordynacja dokumentów i przygotowanie do aktu notarialnego' },
  { id: 'reporting', label: 'Cotygodniowy raport postępów dla właściciela' },
] as const;

export type LeadConditionId = (typeof LEAD_CONDITION_CATALOG)[number]['id'];

export const LEAD_SERVICE_PRESETS = [
  'Pełna obsługa sprzedaży: wycena, sesja zdjęciowa, publikacja, prezentacje i negocjacje do aktu notarialnego.',
  'Marketing i obsługa zapytań: optymalizacja ogłoszenia, kontakt z kupującymi, umawianie wizyt.',
  'Obsługa premium: doradztwo cenowe, staging, raporty tygodniowe dla właściciela.',
] as const;

export const COMMISSION_RATE_MIN = 0;
export const COMMISSION_RATE_MAX = 100;
export const COMMISSION_RATE_STEP = 0.1;
export const COMMISSION_RATE_DEFAULT = 2.5;

export function snapCommissionRate(raw: number): number {
  if (!Number.isFinite(raw)) return COMMISSION_RATE_DEFAULT;
  const stepped = Math.round(raw / COMMISSION_RATE_STEP) * COMMISSION_RATE_STEP;
  const clamped = Math.min(COMMISSION_RATE_MAX, Math.max(COMMISSION_RATE_MIN, stepped));
  // toFixed kills IEEE leftovers like 2.8000000000000003
  return Number(clamped.toFixed(1));
}

export function storeCommissionPercent(raw: number): string {
  return snapCommissionRate(raw).toFixed(1);
}

export function formatCommissionRate(value: number): string {
  return `${snapCommissionRate(value).toFixed(1).replace('.', ',')}%`;
}

export function commissionAmountStep(price: number): number {
  if (!Number.isFinite(price) || price <= 0) return 100;
  const tenthPercent = price * 0.001;
  if (tenthPercent >= 1000) return Math.round(tenthPercent / 1000) * 1000;
  if (tenthPercent >= 100) return Math.round(tenthPercent / 100) * 100;
  return 100;
}

export function snapCommissionAmount(price: number, amount: number): number {
  const step = commissionAmountStep(price);
  const stepped = Math.round(amount / step) * step;
  return Math.min(price, Math.max(0, stepped));
}

export function commissionAmountFromRate(price: number, rate: number): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  return snapCommissionAmount(price, (price * rate) / 100);
}

export function commissionRateFromAmount(price: number, amount: number): number {
  if (!Number.isFinite(price) || price <= 0) return COMMISSION_RATE_DEFAULT;
  return snapCommissionRate((amount / price) * 100);
}

export function formatCommissionAmount(pln: number): string {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 0,
  }).format(pln);
}

export function countPendingConciergeLeads(
  leads: Array<{ status: string }>,
  isAgency: boolean,
): number {
  return leads.filter((l) =>
    isAgency
      ? ['PENDING', 'USER_COUNTER'].includes(l.status)
      : ['PENDING', 'TERMS_PROPOSED', 'USER_COUNTER'].includes(l.status),
  ).length;
}

export type ParsedLeadTerms = {
  conditions: Array<{ id: string; label: string }>;
  customNote: string | null;
  isStructured: boolean;
  rawText: string | null;
};

export function serializeLeadConditions(selectedIds: string[], customNote?: string | null): string {
  const unique = [...new Set(selectedIds.filter(Boolean))];
  return JSON.stringify({
    version: 1,
    conditions: unique,
    customNote: customNote?.trim().slice(0, 500) || null,
  });
}

export function parseLeadConditions(raw: string | null | undefined): ParsedLeadTerms {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) {
    return { conditions: [], customNote: null, isStructured: false, rawText: null };
  }
  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text) as { conditions?: string[]; customNote?: string | null };
      const ids = Array.isArray(parsed.conditions) ? parsed.conditions : [];
      const conditions = ids
        .map((id) => {
          const hit = LEAD_CONDITION_CATALOG.find((c) => c.id === id);
          return hit ? { id: hit.id, label: hit.label } : { id, label: id };
        })
        .filter((c) => c.label);
      return {
        conditions,
        customNote: parsed.customNote?.trim() || null,
        isStructured: true,
        rawText: text,
      };
    } catch {
      /* fall through */
    }
  }
  return {
    conditions: [],
    customNote: null,
    isStructured: false,
    rawText: text,
  };
}

export function leadStatusMeta(status: string, viewerIsAgency: boolean): {
  label: string;
  step: number;
  hint: string;
} {
  const s = String(status || 'PENDING').toUpperCase();
  if (s === 'ACCEPTED') {
    return { label: 'Przekazano agencji', step: 4, hint: 'Oferta jest zarządzana przez wybrane biuro.' };
  }
  if (s === 'REJECTED') {
    return { label: 'Odrzucono', step: 0, hint: 'To zapytanie zostało zamknięte.' };
  }
  if (s === 'TERMS_PROPOSED') {
    return viewerIsAgency
      ? { label: 'Oczekuje na właściciela', step: 3, hint: 'Właściciel otrzymał Twoją propozycję warunków.' }
      : { label: 'Propozycja agencji', step: 3, hint: 'Sprawdź konkretne warunki współpracy — możesz zaakceptować lub odrzucić.' };
  }
  if (s === 'USER_COUNTER') {
    return viewerIsAgency
      ? { label: 'Kontrpropozycja klienta', step: 3, hint: 'Klient zaproponował inne warunki — odpowiedz nową ofertą.' }
      : { label: 'Twoja kontrpropozycja', step: 3, hint: 'Agencja została powiadomiona o Twoich warunkach.' };
  }
  return viewerIsAgency
    ? { label: 'Nowe zapytanie', step: 2, hint: 'Przejrzyj ofertę i prześlij warunki współpracy.' }
    : { label: 'Oczekuje na agencję', step: 2, hint: 'Biuro analizuje ogłoszenie i przygotuje propozycję.' };
}

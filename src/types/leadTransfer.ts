export type EnrichedLeadTransfer = {
  id: number;
  offerId: number;
  ownerId: number;
  agencyId: number;
  status: string;
  commissionRate: number | null;
  commissionTerms: string | null;
  createdAt: string;
  updatedAt: string;
  statusMeta: { label: string; step: number; hint: string };
  offer: {
    id: number;
    title: string;
    price: number;
    pricePln?: number;
    city: string | null;
    district: string | null;
    area: string | null;
    rooms: number | null;
    status: string;
    imageUrl: string;
    locationLabel: string;
    href: string;
  };
  owner: { id: number; name: string; email: string; phone: string | null; image: string | null };
  agency: { id: number; name: string; image: string | null; phone: string | null };
};

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
  const stepped = Math.round(raw / COMMISSION_RATE_STEP) * COMMISSION_RATE_STEP;
  return Math.min(COMMISSION_RATE_MAX, Math.max(COMMISSION_RATE_MIN, stepped));
}

export function formatCommissionRate(value: number): string {
  return `${value.toFixed(1).replace('.', ',')}%`;
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

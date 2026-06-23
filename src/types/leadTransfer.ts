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

export const LEAD_SERVICE_PRESETS = [
  'Pełna obsługa sprzedaży: wycena, sesja zdjęciowa, publikacja, prezentacje i negocjacje do aktu notarialnego.',
  'Marketing i obsługa zapytań: optymalizacja ogłoszenia, kontakt z kupującymi, umawianie wizyt.',
  'Obsługa premium: doradztwo cenowe, staging, raporty tygodniowe dla właściciela.',
] as const;

export const COMMISSION_RATE_MIN = 0.5;
export const COMMISSION_RATE_MAX = 10;
export const COMMISSION_RATE_STEP = 0.1;
export const COMMISSION_RATE_DEFAULT = 2.5;

export function snapCommissionRate(raw: number): number {
  const stepped = Math.round(raw / COMMISSION_RATE_STEP) * COMMISSION_RATE_STEP;
  return Math.min(COMMISSION_RATE_MAX, Math.max(COMMISSION_RATE_MIN, stepped));
}

export function formatCommissionRate(value: number): string {
  return `${value.toFixed(1).replace('.', ',')}%`;
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

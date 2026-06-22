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

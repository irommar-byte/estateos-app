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

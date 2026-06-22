export type LeadTransferStatus =
  | 'PENDING'
  | 'TERMS_PROPOSED'
  | 'USER_COUNTER'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'COUNTERED';

export const LEAD_SERVICE_PRESETS = [
  'Pełna obsługa sprzedaży: wycena, sesja zdjęciowa, publikacja, prezentacje i negocjacje do aktu notarialnego.',
  'Marketing i obsługa zapytań: optymalizacja ogłoszenia, kontakt z kupującymi, umawianie wizyt.',
  'Obsługa premium: doradztwo cenowe, staging, raporty tygodniowe dla właściciela.',
] as const;

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
      : { label: 'Propozycja agencji', step: 3, hint: 'Sprawdź prowizję i zakres usług — możesz zaakceptować lub odrzucić.' };
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

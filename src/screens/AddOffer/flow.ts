export const ADD_OFFER_TOTAL_STEPS = 6;

/** Zgodnie z UI kroków 1–6 i polami w `useOfferStore` / ekranach AddOffer */
const TRANSACTION_TYPES = new Set(['SELL', 'SALE', 'RENT']);
const PROPERTY_TYPES = new Set(['FLAT', 'APARTMENT', 'HOUSE', 'PREMISES', 'PLOT']);

const isTruthyNumber = (value: unknown) => {
  const num = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(num) && num > 0;
};

const hasLatLng = (draft: any) =>
  isTruthyNumber(draft?.lat) &&
  isTruthyNumber(draft?.lng) &&
  draft.lat !== null &&
  draft.lng !== null;

export const isStepValid = (step: number, draft: any) => {
  switch (step) {
    case 1: {
      const hasTransactionType = TRANSACTION_TYPES.has(String(draft?.transactionType || ''));
      const hasPropertyType = PROPERTY_TYPES.has(String(draft?.propertyType || ''));
      const needsCondition = String(draft?.propertyType || '') !== 'PLOT';
      const hasCondition = !needsCondition || !!draft?.condition;
      return hasTransactionType && hasPropertyType && hasCondition;
    }
    case 2:
      return !!draft?.city && !!draft?.district && hasLatLng(draft);
    case 3: {
      const hasArea = isTruthyNumber(draft?.area);
      if (String(draft?.propertyType || '') === 'PLOT') return hasArea;
      const yearRaw = draft?.yearBuilt ?? draft?.buildYear;
      const hasYear = !!String(yearRaw ?? '').trim();
      return hasArea && !!draft?.rooms && !!draft?.floor && hasYear;
    }
    case 4:
      return isTruthyNumber(draft?.price);
    case 5:
      return Array.isArray(draft?.images) && draft.images.length > 0 && !!String(draft?.title || '').trim();
    default:
      return true;
  }
};

export const getStepBlockMessage = (step: number) => {
  switch (step) {
    case 1:
      return 'Uzupełnij typ transakcji, rodzaj nieruchomości i stan, aby przejść dalej.';
    case 2:
      return 'Uzupełnij lokalizację i ustaw pinezkę na mapie, aby przejść dalej.';
    case 3:
      return 'Uzupełnij kluczowe parametry (metraż, pokoje, piętro, rok budowy), aby przejść dalej.';
    case 4:
      return 'Podaj cenę oferty, aby przejść dalej.';
    case 5:
      return 'Dodaj tytuł i minimum 1 zdjęcie, aby przejść do publikacji.';
    default:
      return 'Uzupełnij wymagane pola w bieżącym kroku.';
  }
};

/** Etykieta rozliczenia sesji zdjęciowej (admin + kalendarz). */
export function photoSessionPaymentLabel(isProFree: boolean): string {
  return isProFree
    ? 'GRATIS — benefit Investor Pro (pierwsza sesja na koncie)'
    : '199 zł — sesja płatna';
}

export function photoSessionPaymentShort(isProFree: boolean): string {
  return isProFree ? 'GRATIS (Investor Pro)' : '199 zł';
}

export function photoSessionPaymentAdminHint(isProFree: boolean): string {
  return isProFree
    ? 'Klient korzysta z darmowej sesji w ramach Investor Pro (pierwsza rezerwacja na koncie).'
    : 'Sesja do rozliczenia — 199 zł (płatność poza aplikacją / faktura).';
}

/** Etykieta rozliczenia sesji zdjęciowej (admin + kalendarz). */
export function photoSessionPaymentLabel(_isProFree: boolean): string {
  return '199 zł — sesja płatna (Warszawa)';
}

export function photoSessionPaymentShort(_isProFree: boolean): string {
  return '199 zł';
}

export function photoSessionPaymentAdminHint(_isProFree: boolean): string {
  return 'Sesja do rozliczenia — 199 zł (fotograf Warszawa; płatność poza aplikacją / faktura).';
}

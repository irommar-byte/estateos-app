export function isOfferLegalColumnMissingError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  return (
    /offer\.landregistrynumber/i.test(message) ||
    /offer\.apartmentnumber/i.test(message) ||
    (/unknown column/i.test(message) && /(landregistrynumber|apartmentnumber)/i.test(message)) ||
    (/does not exist/i.test(message) && /(landregistrynumber|apartmentnumber)/i.test(message))
  );
}

export function isOfferAlterPrivilegeError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  return (
    /access denied/i.test(message) &&
    (/alter/i.test(message) || /information_schema/i.test(message) || /columns/i.test(message))
  ) || /alter command denied/i.test(message) || /command denied to user/i.test(message);
}

export function isOfferSchemaCompatibilityError(error: unknown): boolean {
  return isOfferLegalColumnMissingError(error) || isOfferAlterPrivilegeError(error);
}

export function getOfferSchemaCompatibilityMessage(): string {
  return 'Tymczasowy problem zgodności schematu ofert. Spróbuj ponownie za chwilę. Jeśli problem wraca, skontaktuj się z obsługą.';
}

/** Nie zwracaj surowych komunikatów Prisma / P2022 do klienta mobilnego. */
export function toPublicOfferErrorMessage(error: unknown): string {
  if (isOfferSchemaCompatibilityError(error)) {
    return getOfferSchemaCompatibilityMessage();
  }
  const msg = error instanceof Error ? error.message : String(error || '');
  if (
    /\bP20\d{2}\b/i.test(msg) ||
    /Invalid\s+`?prisma\.offer/i.test(msg) ||
    /Unknown column/i.test(msg) ||
    /does not exist in the current database/i.test(msg)
  ) {
    return 'Błąd zapisu lub odczytu oferty. Spróbuj ponownie. Jeśli się powtarza, skontaktuj się z obsługą.';
  }
  return msg || 'Błąd serwera';
}

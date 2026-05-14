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

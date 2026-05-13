/**
 * Normalizacja numeru do cyfr bez znaku „+” (format oczekiwany przez bramki SMS typu SMSPlanet).
 *
 * Zakłada, że aplikacja mobilna zapisuje numery w E.164 / `formatInternational` (libphonenumber-js)
 * — po usunięciu separatorów otrzymujemy prefiks kraju + numer krajowy.
 *
 * Legacy (tylko PL): same 9 cyfr krajowych → automatycznie `48` + cyfry.
 *
 * Opcjonalnie (pełna zgodność z pickerem krajów w aplikacji): `npm i libphonenumber-js`
 * i zamień implementację na `parsePhoneNumberFromString(..., defaultCountry)` + `isValid()`.
 */
const E164_MIN_TOTAL_DIGITS = 10;
const E164_MAX_TOTAL_DIGITS = 15;

export function parsePhoneToE164Digits(phone: string): string {
  const raw = String(phone || '').trim();
  if (!raw) throw new Error('Brak numeru telefonu');

  let digits = raw.replace(/\D/g, '');
  if (!digits) throw new Error('Brak numeru telefonu');

  if (digits.length === 9) {
    digits = `48${digits}`;
  }

  if (digits.length < E164_MIN_TOTAL_DIGITS || digits.length > E164_MAX_TOTAL_DIGITS) {
    throw new Error('Nieprawidłowy numer telefonu');
  }

  return digits;
}

/** E.164 z prefiksem „+” (np. do zapisu w DB). */
export function parsePhoneToE164(phone: string): string {
  return `+${parsePhoneToE164Digits(phone)}`;
}

/**
 * Normalizacja numerów telefonu do E.164 (+491701234567).
 * Używana przy zapisie, wyszukiwaniu duplikatów i wysyłce SMS.
 */

const E164_MIN_DIGITS = 8;
const E164_MAX_DIGITS = 15;

export function phoneDigitsOnly(raw: unknown): string {
  return String(raw ?? '').replace(/\D/g, '');
}

/**
 * Zwraca numer w E.164 lub null, gdy nie da się go sensownie zbudować.
 * - Wejście z "+" → + i wszystkie cyfry (bez wymuszania PL).
 * - 9 cyfr bez kraju → +48… (kompatybilność wsteczna).
 * - 11 cyfr zaczynających się od 48 → +48…
 * - 10–15 cyfr bez "+" → traktowane jako pełny numer międzynarodowy (+cyfry).
 */
export function normalizePhoneE164(raw: unknown): string | null {
  const input = String(raw ?? '').trim();
  if (!input) return null;

  const hasPlus = input.startsWith('+');
  const digits = phoneDigitsOnly(input);
  if (!digits) return null;

  if (hasPlus) {
    if (digits.length < E164_MIN_DIGITS || digits.length > E164_MAX_DIGITS) return null;
    return `+${digits}`;
  }

  if (digits.length === 9) {
    return `+48${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('48')) {
    return `+${digits}`;
  }

  if (digits.length >= 10 && digits.length <= E164_MAX_DIGITS) {
    return `+${digits}`;
  }

  return null;
}

/** Warianty do wyszukiwania w bazie (E.164 + stare formaty PL ze spacjami). */
export function buildPhoneLookupVariants(raw: unknown): string[] {
  const e164 = normalizePhoneE164(raw);
  const rawTrim = String(raw ?? '').trim();
  const variants = new Set<string>();

  if (rawTrim) variants.add(rawTrim);

  if (!e164) {
    const digits = phoneDigitsOnly(raw);
    if (digits) variants.add(digits);
    return Array.from(variants).filter(Boolean);
  }

  const digits = e164.slice(1);
  variants.add(e164);
  variants.add(digits);
  variants.add(`+${digits}`);

  if (e164.startsWith('+48') && digits.length === 11) {
    const local = digits.slice(2);
    if (local.length === 9) {
      variants.add(local);
      variants.add(`48${local}`);
      variants.add(`+48${local}`);
      variants.add(
        `+48 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`
      );
    }
  }

  return Array.from(variants).filter(Boolean);
}

/** Cyfry do API SMS (bez "+", z kodem kraju). */
export function normalizePhoneForSms(storedPhone: string): string {
  const e164 = normalizePhoneE164(storedPhone);
  if (e164) return e164.slice(1);
  const digits = phoneDigitsOnly(storedPhone);
  if (digits.length === 9) return `48${digits}`;
  return digits;
}

export function extractPhoneFromBody(body: Record<string, unknown>): unknown {
  return (
    body.contactPhone ??
    body.phone ??
    body.phoneNumber ??
    body.mobile ??
    undefined
  );
}

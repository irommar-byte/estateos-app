import {
  AsYouType,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';

/**
 * Kraje dostępne przy numerze telefonu: UE + EFTA + UK + US + wybrane kraje europejskie spoza UE.
 * (Kontrakt UI — backend i tak waliduje po swojej stronie.)
 */
export const ALLOWED_PHONE_COUNTRIES: CountryCode[] = [
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
  'GB',
  'NO',
  'CH',
  'IS',
  'LI',
  'US',
  'UA',
  'AL',
  'BA',
  'MK',
  'ME',
  'RS',
  'MD',
];

export const ALLOWED_PHONE_COUNTRY_SET = new Set<string>(ALLOWED_PHONE_COUNTRIES);

export function isAllowedPhoneCountry(iso: string | undefined | null): iso is CountryCode {
  return Boolean(iso && ALLOWED_PHONE_COUNTRY_SET.has(iso));
}

export function dialCodeFor(iso: CountryCode): string {
  return getCountryCallingCode(iso);
}

/** Nazwa kraju w „jego” locale (np. Deutschland, Polska, United States). */
export function countryLabelInOwnLanguage(iso: CountryCode): string {
  try {
    const dn = new Intl.DisplayNames([iso], { type: 'region' });
    return dn.of(iso) || iso;
  } catch {
    return iso;
  }
}

/** Etykieta do sortowania listy (polski — stabilne sortowanie dla użytkownika PL). */
export function countryLabelSortPl(iso: CountryCode): string {
  try {
    const dn = new Intl.DisplayNames(['pl-PL'], { type: 'region' });
    return dn.of(iso) || iso;
  } catch {
    return iso;
  }
}

export function getDeviceRegionCountry(): CountryCode {
  try {
    const loc = Intl.DateTimeFormat().resolvedOptions().locale || 'pl-PL';
    const m = loc.match(/-([A-Z]{2})$/i);
    const r = ((m?.[1] || 'PL').toUpperCase()) as CountryCode;
    if (ALLOWED_PHONE_COUNTRY_SET.has(r)) return r;
  } catch {
    /* noop */
  }
  return 'PL';
}

export function flagEmojiFromIso2(iso: string): string {
  const u = String(iso || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  if (u.length !== 2) return '🏳️';
  const A = 0x1f1e6;
  const chars = [...u].map((c) => String.fromCodePoint(A + c.charCodeAt(0) - 65));
  return chars.join('');
}

export type ParsedLine = {
  iso: CountryCode;
  /** Cyfry krajowego numeru (bez prefiksu +). */
  nationalDigits: string;
};

/** Z istniejącego stringu telefonu (E.164 lub legacy PL) — tylko dozwolone kraje. */
export function parseStoredPhoneToLine(phone?: string | null, fallbackIso: CountryCode = 'PL'): ParsedLine {
  const raw = String(phone || '').trim();
  if (!raw) {
    return { iso: fallbackIso, nationalDigits: '' };
  }
  let p = parsePhoneNumberFromString(raw);
  if (p?.country && ALLOWED_PHONE_COUNTRY_SET.has(p.country)) {
    return { iso: p.country, nationalDigits: String(p.nationalNumber || '') };
  }
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 9 && !raw.includes('+')) {
    p = parsePhoneNumberFromString(digits, 'PL');
    if (p?.country && ALLOWED_PHONE_COUNTRY_SET.has(p.country)) {
      return { iso: 'PL', nationalDigits: String(p.nationalNumber || '') };
    }
  }
  if (digits.startsWith('48') && digits.length >= 11) {
    p = parsePhoneNumberFromString(`+${digits}`);
    if (p?.country && ALLOWED_PHONE_COUNTRY_SET.has(p.country)) {
      return { iso: p.country, nationalDigits: String(p.nationalNumber || '') };
    }
  }
  return { iso: fallbackIso, nationalDigits: '' };
}

export function formatNationalAsYouType(iso: CountryCode, nationalDigits: string): string {
  const d = String(nationalDigits || '').replace(/\D/g, '');
  const fmt = new AsYouType(iso);
  fmt.input(d);
  return fmt.getChars() || '';
}

export function buildE164FromNational(iso: CountryCode, nationalDigits: string) {
  const d = String(nationalDigits || '').replace(/\D/g, '');
  if (!d) return null;
  const p = parsePhoneNumberFromString(d, iso);
  if (!p?.isValid()) return null;
  return p.number as string;
}

export function inferCountryFromPhone(phone?: string | null, fallback: CountryCode = 'PL'): CountryCode {
  const raw = String(phone || '').trim();
  if (!raw || raw === 'Brak numeru') return fallback;
  const p = parsePhoneNumberFromString(raw);
  if (p?.country && ALLOWED_PHONE_COUNTRY_SET.has(p.country)) return p.country;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 9 && !raw.includes('+')) return 'PL';
  const p2 = parsePhoneNumberFromString(`+${digits}`);
  if (p2?.country && ALLOWED_PHONE_COUNTRY_SET.has(p2.country)) return p2.country;
  return fallback;
}

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

/** Nazwa kraju w języku tego państwa, wielkimi literami (np. POLSKA, DEUTSCHLAND). */
export function countryLabelInOwnLanguageUpper(iso: string): string {
  const code = String(iso || '')
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return code;
  const label = countryLabelInOwnLanguage(code as CountryCode);
  const locale = `${code.toLowerCase()}-${code}`;
  try {
    return label.toLocaleUpperCase(locale);
  } catch {
    return label.toUpperCase();
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

/** Pierwszy sensowny numer z obiektu usera API (różne nazwy pól na backendzie). */
export function extractRawPhoneFromApi(apiUser: any): string | null {
  if (!apiUser || typeof apiUser !== 'object') return null;
  const candidates = [
    apiUser.phone,
    apiUser.contactPhone,
    apiUser.phoneNumber,
    apiUser.mobile,
    apiUser.mobilePhone,
    apiUser.user?.phone,
    apiUser.user?.contactPhone,
  ];
  for (const c of candidates) {
    const s = String(c ?? '').trim();
    if (s && s !== 'null' && s !== 'undefined') return s;
  }
  return null;
}

export function userHasDialablePhone(phone?: string | null): boolean {
  const raw = String(phone || '').trim();
  if (!raw || raw === 'Brak numeru') return false;
  return Boolean(normalizePhoneE164(raw) || raw.replace(/\D/g, '').length >= 6);
}

/**
 * Kanoniczny E.164 (+48123456789) z dowolnego zapisu API / legacy.
 * Kolejność: parse bezpośredni → cyfry z prefiksem „+” → legacy PL (9 cyfr krajowych).
 */
export function normalizePhoneE164(phone?: string | null, hintIso: CountryCode = 'PL'): string | null {
  const raw = String(phone || '').trim();
  if (!raw || raw === 'Brak numeru') return null;

  let p = parsePhoneNumberFromString(raw);
  if (p?.isValid() && p.country && ALLOWED_PHONE_COUNTRY_SET.has(p.country)) {
    return p.number as string;
  }

  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  if (!raw.includes('+')) {
    p = parsePhoneNumberFromString(`+${digits}`);
    if (p?.isValid() && p.country && ALLOWED_PHONE_COUNTRY_SET.has(p.country)) {
      return p.number as string;
    }
  }

  if (digits.length === 9 && !raw.includes('+')) {
    p = parsePhoneNumberFromString(digits, 'PL');
    if (p?.isValid() && p.country === 'PL') {
      return p.number as string;
    }
  }

  return null;
}

/** Format do wyświetlenia w profilu (np. „+49 170 1234567”). */
export function formatPhoneForDisplay(phone?: string | null, hintIso: CountryCode = 'PL'): string {
  if (!phone || !String(phone).trim()) return 'Brak numeru';
  const raw = String(phone).trim();
  if (raw === 'Brak numeru') return 'Brak numeru';
  const e164 = normalizePhoneE164(raw, hintIso);
  if (e164) {
    const n = parsePhoneNumberFromString(e164);
    if (n?.isValid()) return n.formatInternational();
  }
  if (raw.replace(/\D/g, '').length >= 6) return raw;
  return 'Brak numeru';
}

/** Uzupełnia brakujący numer po rejestracji, gdy login/GET /auth go nie zwraca. */
export function mergePhoneIntoUser<T extends { phone?: string }>(
  user: T | null,
  phoneE164?: string | null,
): T | null {
  if (!user) return user;
  if (userHasDialablePhone(user.phone)) return user;
  const e164 = normalizePhoneE164(phoneE164);
  if (!e164) return user;
  return { ...user, phone: formatPhoneForDisplay(e164) };
}

/** Z istniejącego stringu telefonu (E.164 lub legacy PL) — tylko dozwolone kraje. */
export function parseStoredPhoneToLine(phone?: string | null, fallbackIso: CountryCode = 'PL'): ParsedLine {
  const raw = String(phone || '').trim();
  if (!raw) {
    return { iso: fallbackIso, nationalDigits: '' };
  }

  const e164 = normalizePhoneE164(raw, fallbackIso);
  if (e164) {
    const p = parsePhoneNumberFromString(e164);
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
  const line = parseStoredPhoneToLine(raw, fallback);
  if (line.nationalDigits.length > 0) return line.iso;
  return fallback;
}

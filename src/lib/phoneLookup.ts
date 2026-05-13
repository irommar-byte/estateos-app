import { parsePhoneToE164, parsePhoneToE164Digits } from '@/lib/phoneE164';

/**
 * Kanoniczny zapis telefonu w DB: zawsze E.164 z prefiksem „+” (np. `+48123456789`, `+491701234567`).
 * `null` / pusty string → `null`.
 */
export function normalizePhoneForStorage(phone: string | null | undefined): string | null {
  const raw = String(phone ?? '').trim();
  if (!raw) return null;
  try {
    return parsePhoneToE164(raw);
  } catch {
    return null;
  }
}

/**
 * Warianty tego samego numeru do wyszukiwania duplikatów w DB (legacy + nowe wpisy).
 * Użyj w `findFirst({ where: { OR: expandPhoneSearchVariants(phone).map(...) } })`.
 *
 * Obejmuje m.in. stary polski format z odstępami z `/api/register`.
 */
export function expandPhoneSearchVariants(raw: string): string[] {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return [];

  let digits: string;
  let e164: string;
  try {
    digits = parsePhoneToE164Digits(trimmed);
    e164 = `+${digits}`;
  } catch {
    return [trimmed];
  }

  const out = new Set<string>([trimmed, e164, digits, `+${digits}`]);

  // Legacy PL: 48 + 9 cyfr krajowych
  if (digits.startsWith('48') && digits.length === 11) {
    const local = digits.slice(2);
    out.add(local);
    out.add(`48${local}`);
    out.add(`+48${local}`);
    const a = local.slice(0, 3);
    const b = local.slice(3, 6);
    const c = local.slice(6);
    out.add(`+48 ${a} ${b} ${c}`);
  }

  return Array.from(out).filter(Boolean);
}

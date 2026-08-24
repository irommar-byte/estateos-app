import crypto from 'crypto';
import { parsePesel } from '@/lib/pesel';
import { resolveSessionSecret } from '@/lib/sessionUtils';

/** HMAC-SHA256 of a validated PESEL — never store/compare raw PESEL for cross-agent lookups. */
export function hashPesel(raw: string | null | undefined): string | null {
  const parsed = parsePesel(String(raw || ''));
  if (!parsed) return null;
  return crypto.createHmac('sha256', resolveSessionSecret()).update(`pesel:${parsed.pesel}`).digest('hex');
}

export function normalizePeselDigits(raw: string | null | undefined): string | null {
  const parsed = parsePesel(String(raw || ''));
  return parsed?.pesel ?? null;
}

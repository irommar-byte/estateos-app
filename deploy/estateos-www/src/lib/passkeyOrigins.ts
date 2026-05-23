import { getPasskeyOrigin } from '@/lib/env.server';

export function decodeClientDataJsonBase64(value: string): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf-8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function extractOriginFromWebAuthnResponse(response: unknown): string | null {
  if (!response || typeof response !== 'object') return null;
  const r = response as Record<string, unknown>;
  const nested = r.response as Record<string, unknown> | undefined;
  const candidate =
    (typeof r.clientDataJSON === 'string' && r.clientDataJSON) ||
    (typeof nested?.clientDataJSON === 'string' && nested.clientDataJSON) ||
    null;
  if (!candidate) return null;
  const clientData = decodeClientDataJsonBase64(candidate);
  const origin = String(clientData?.origin || '').trim();
  return origin || null;
}

/** Dozwolone origin dla weryfikacji (www + typowe natywne). */
export function buildExpectedPasskeyOrigins(parsedFromClient: string | null): string | string[] {
  const configuredOrigin = String(getPasskeyOrigin() || '').replace(/\/$/, '');
  const originCandidates = new Set<string>();

  if (configuredOrigin) originCandidates.add(configuredOrigin);

  if (parsedFromClient) originCandidates.add(parsedFromClient);

  if (process.env.NODE_ENV === 'production') {
    originCandidates.add('https://estateos.pl');
    originCandidates.add('https://www.estateos.pl');
  } else {
    originCandidates.add('http://localhost:3000');
    originCandidates.add('http://127.0.0.1:3000');
  }

  const list = Array.from(originCandidates).filter(Boolean);
  return list.length > 1 ? list : list[0] || configuredOrigin;
}

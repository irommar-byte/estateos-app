let validated = false;

function isSet(key: string): boolean {
  const value = process.env[key];
  return Boolean(value && value.trim());
}

export function validateCriticalEnv(): { ok: boolean; missing: string[] } {
  const missing: string[] = [];

  // At least one JWT/session secret must exist.
  if (!isSet('NEXTAUTH_SECRET') && !isSet('JWT_SECRET') && !isSet('AUTH_SECRET')) {
    missing.push('NEXTAUTH_SECRET|JWT_SECRET|AUTH_SECRET');
  }

  // Passkey RP domain should be explicit in production.
  if (process.env.NODE_ENV === 'production' && !isSet('PASSKEY_RP_ID')) {
    missing.push('PASSKEY_RP_ID');
  }

  if (process.env.NODE_ENV === 'production' && !isSet('PASSKEY_ORIGIN') && !isSet('NEXTAUTH_URL')) {
    missing.push('PASSKEY_ORIGIN|NEXTAUTH_URL');
  }

  return { ok: missing.length === 0, missing };
}

export function assertCriticalEnv(): void {
  if (validated) return;
  validated = true;

  if (process.env.NODE_ENV !== 'production') return;

  const result = validateCriticalEnv();
  if (!result.ok) {
    throw new Error(`Missing required production env vars: ${result.missing.join(', ')}`);
  }
}

function stripUrlToHost(input: string): string {
  return input
    .replace(/^https?:\/\//i, '')
    .split('/')[0]
    ?.split(':')[0]
    ?.trim() || '';
}

export function getPasskeyRpId(): string {
  assertCriticalEnv();
  const fallback = process.env.NODE_ENV === 'production' ? 'estateos.pl' : 'localhost';
  const raw = process.env.PASSKEY_RP_ID?.trim();
  if (!raw) return fallback;
  const host = stripUrlToHost(raw.includes('://') ? raw : `https://${raw}`);
  return host || fallback;
}

export function getPasskeyOrigin(): string {
  assertCriticalEnv();
  const raw =
    process.env.PASSKEY_ORIGIN?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    (process.env.NODE_ENV === 'production' ? 'https://estateos.pl' : 'http://localhost:3000');
  return raw.replace(/\/$/, '');
}

import { startAuthentication } from '@simplewebauthn/browser';

export function readTvPairCode(searchParams: URLSearchParams): string {
  return String(searchParams.get('pair') || searchParams.get('pairCode') || '')
    .trim()
    .toUpperCase();
}

export function isTvosPairingRequest(searchParams: URLSearchParams): boolean {
  const source = String(searchParams.get('source') || '').trim().toLowerCase();
  const pairCode = readTvPairCode(searchParams);
  return source === 'tvos' || pairCode.length >= 4;
}

export async function completeTvPairing(
  pairCode: string,
  token: string,
): Promise<{ success: boolean; error?: string }> {
  const normalized = pairCode.trim().toUpperCase();
  if (!normalized || !token) {
    return { success: false, error: 'Brak kodu parowania lub tokenu' };
  }

  const res = await fetch('/api/mobile/v1/tv/pair/complete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-access-token': token,
      'auth-token': token,
    },
    body: JSON.stringify({ pairCode: normalized }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success) {
    return {
      success: false,
      error: String(data?.error || 'Nie udało się połączyć z Apple TV'),
    };
  }

  return { success: true };
}

export async function loginWithMobilePassword(
  email: string,
  password: string,
): Promise<{ token: string } | { error: string }> {
  const res = await fetch('/api/mobile/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.success || !data?.token) {
    return { error: String(data?.error || data?.message || 'Błędne dane logowania') };
  }
  return { token: String(data.token) };
}

export async function loginWithMobilePasskey(
  email?: string | null,
): Promise<{ token: string } | { error: string }> {
  const optionsRes = await fetch('/api/mobile/v1/passkeys/auth-options', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(email ? { email } : {}),
  });
  const options = await optionsRes.json().catch(() => ({}));
  if (!optionsRes.ok || options?.error) {
    return { error: String(options?.error || 'Nie udało się rozpocząć logowania Passkey') };
  }

  const sessionId = String(options?.sessionId || '').trim();
  const { sessionId: _ignored, ...authOptions } = options;

  let asseResp;
  try {
    asseResp = await startAuthentication(authOptions);
  } catch {
    return { error: 'Logowanie Passkey zostało anulowane' };
  }

  const verifyRes = await fetch('/api/mobile/v1/passkeys/auth-verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...asseResp, sessionId }),
  });
  const data = await verifyRes.json().catch(() => ({}));
  if (!verifyRes.ok || !data?.token) {
    return { error: String(data?.error || 'Weryfikacja Passkey nie powiodła się') };
  }

  return { token: String(data.token) };
}

export async function pairTvAfterMobileLogin(
  pairCode: string,
  email: string,
  password: string,
): Promise<{ success: boolean; error?: string }> {
  const login = await loginWithMobilePassword(email, password);
  if ('error' in login) return { success: false, error: login.error };
  return completeTvPairing(pairCode, login.token);
}

export async function pairTvAfterMobilePasskey(
  pairCode: string,
  email?: string | null,
): Promise<{ success: boolean; error?: string }> {
  const login = await loginWithMobilePasskey(email);
  if ('error' in login) return { success: false, error: login.error };
  return completeTvPairing(pairCode, login.token);
}

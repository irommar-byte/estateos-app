import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/jwtMobile';

export function parseUserIdFromBearer(req: Request): number | null {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth) return null;
  const rawToken = auth.replace(/^Bearer\s+/i, '').trim();
  if (!rawToken) return null;
  const payload = verifyMobileToken(rawToken) as Record<string, unknown> | null;
  const userId = Number(payload?.id ?? payload?.userId ?? payload?.sub);
  return Number.isFinite(userId) && userId > 0 ? userId : null;
}

/** Z body lub JWT (Profil → Passkey bez ponownego wpisywania e-maila). */
export async function resolvePasskeyUser(
  req: Request,
  body: Record<string, unknown>
): Promise<{ id: number; email: string } | null> {
  const userFromBody = body?.user;
  const emailFromNestedUser =
    userFromBody && typeof userFromBody === 'object'
      ? String((userFromBody as Record<string, unknown>).email ?? '')
      : '';
  const emailFromBody = String(body?.email ?? emailFromNestedUser ?? '').trim().toLowerCase();
  if (emailFromBody) {
    const user = await prisma.user.findUnique({ where: { email: emailFromBody } });
    if (user) return { id: user.id, email: user.email };
  }

  const userId = parseUserIdFromBearer(req);
  if (!userId) return null;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.email) return null;
  return { id: user.id, email: user.email };
}

function isRegistrationResponseJSON(value: unknown): value is RegistrationResponseJSON {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.rawId === 'string' &&
    typeof o.type === 'string' &&
    o.response != null &&
    typeof o.response === 'object'
  );
}

export function extractRegistrationResponse(
  body: Record<string, unknown>
): RegistrationResponseJSON | null {
  const candidates = [
    body?.credential,
    body?.registrationResponse,
    body?.attestationResponse,
    body,
    body?.publicKey,
  ];
  for (const candidate of candidates) {
    if (isRegistrationResponseJSON(candidate)) return candidate;
  }
  return null;
}

function isAuthenticationResponseJSON(value: unknown): value is AuthenticationResponseJSON {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.rawId === 'string' &&
    typeof o.type === 'string' &&
    o.response != null &&
    typeof o.response === 'object'
  );
}

/** Pełna odpowiedź WebAuthn (nie samo pole `response` z JSON). */
export function extractAuthenticationResponse(
  body: Record<string, unknown>
): AuthenticationResponseJSON | null {
  const candidates = [body?.credential, body?.assertion, body, body?.response];
  for (const candidate of candidates) {
    if (isAuthenticationResponseJSON(candidate)) return candidate;
  }
  return null;
}

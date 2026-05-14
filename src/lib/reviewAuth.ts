import { jwtVerify } from 'jose';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';
import { decryptSession } from '@/lib/sessionUtils';
import { verifyMobileToken } from '@/lib/jwtMobile';

function toPositiveInt(value: unknown): number | null {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function normalizeToken(raw: string | null | undefined): string | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  if (value.toLowerCase().startsWith('bearer ')) {
    const stripped = value.slice('Bearer '.length).trim();
    return stripped || null;
  }
  return value;
}

export function collectReviewAuthSignals(req: Request, dealToken?: string | null) {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  const xAccessToken = req.headers.get('x-access-token');
  const authToken = req.headers.get('auth-token');

  return {
    hasAuthorizationHeader: Boolean(authHeader),
    hasXAccessTokenHeader: Boolean(xAccessToken),
    hasAuthTokenHeader: Boolean(authToken),
    hasDealTokenCookie: Boolean(dealToken),
  };
}

export async function resolveUserIdFromReviewAuth(params: {
  req: Request;
  sessionToken?: string | null;
  dealToken?: string | null;
}) {
  const { req, sessionToken, dealToken } = params;

  if (sessionToken) {
    try {
      const session = decryptSession(sessionToken);
      const fromSessionId = toPositiveInt((session as { id?: unknown } | null)?.id);
      if (fromSessionId) return fromSessionId;

      const email = String((session as { email?: unknown } | null)?.email || '').trim();
      if (email) {
        const user = await prisma.user.findFirst({
          where: { email },
          select: { id: true },
        });
        if (user?.id) return user.id;
      }
    } catch {
      // Continue with token auth fallback.
    }
  }

  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  const xAccessToken = req.headers.get('x-access-token');
  const authToken = req.headers.get('auth-token');
  const tokensToTry = [
    normalizeToken(authHeader),
    normalizeToken(xAccessToken),
    normalizeToken(authToken),
    normalizeToken(dealToken),
  ].filter(Boolean) as string[];

  const secretRaw = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || '';

  for (const token of tokensToTry) {
    const verified = verifyMobileToken(token) as { id?: unknown; userId?: unknown; sub?: unknown } | null;
    const verifiedId = toPositiveInt(verified?.id ?? verified?.userId ?? verified?.sub);
    if (verifiedId) return verifiedId;

    if (secretRaw) {
      try {
        const { payload } = await jwtVerify(token, new TextEncoder().encode(secretRaw));
        const jwtVerifyId = toPositiveInt(payload.id ?? payload.sub);
        if (jwtVerifyId) return jwtVerifyId;
      } catch {
        // Continue with decode fallback.
      }
    }

    const decoded = jwt.decode(token) as { id?: unknown; userId?: unknown; sub?: unknown } | null;
    const decodedId = toPositiveInt(decoded?.id ?? decoded?.userId ?? decoded?.sub);
    if (decodedId) return decodedId;
  }

  return null;
}

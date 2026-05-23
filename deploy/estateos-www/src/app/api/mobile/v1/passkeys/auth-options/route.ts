import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { setLoginPasskeyChallenge } from '../_challengeStore';
import { checkRateLimit, rateLimitResponse } from '@/lib/securityRateLimit';
import { getClientIp, logEvent } from '@/lib/observability';
import { getPasskeyRpId } from '@/lib/env.server';
import { normalizeCredentialIdToBase64URL } from '@/lib/passkeyDbEncoding';

export async function POST(req: Request) {
  const ip = getClientIp(req);

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || body?.identifier || body?.login || '').trim().toLowerCase();

    const ipBucket = checkRateLimit(`mobile-passkeys-auth-options:ip:${ip}`, 20, 60_000);
    if (!ipBucket.allowed) return rateLimitResponse(ipBucket.retryAfterSeconds);

    if (email) {
      const idBucket = checkRateLimit(`mobile-passkeys-auth-options:id:${email}`, 8, 60_000);
      if (!idBucket.allowed) return rateLimitResponse(idBucket.retryAfterSeconds);
    }

    const rpID = getPasskeyRpId();
    const sessionId = crypto.randomUUID();

    if (email) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return NextResponse.json({ error: 'Nie znaleziono użytkownika' }, { status: 404 });
      }

      const authenticators = await prisma.authenticator.findMany({ where: { userId: user.id } });
      if (!authenticators.length) {
        return NextResponse.json({ error: 'Brak kluczy Passkey' }, { status: 400 });
      }

      const allowCredentials = authenticators.map((auth) => ({
        id: normalizeCredentialIdToBase64URL(auth.credentialID),
        type: 'public-key' as const,
        transports: ['internal', 'hybrid'] as ('internal' | 'hybrid')[],
      }));

      const options = await generateAuthenticationOptions({
        rpID,
        userVerification: 'preferred',
        allowCredentials,
      });
      await setLoginPasskeyChallenge(sessionId, options.challenge);
      return NextResponse.json({ ...options, sessionId });
    }

    const options = await generateAuthenticationOptions({ rpID, userVerification: 'preferred' });
    await setLoginPasskeyChallenge(sessionId, options.challenge);
    return NextResponse.json({ ...options, sessionId });
  } catch (error) {
    logEvent('error', 'mobile_passkey_auth_options_failed', 'api.mobile.v1.passkeys.auth-options', {
      ip,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const bucket = checkRateLimit(`mobile-passkeys-auth-options-get:ip:${ip}`, 20, 60_000);
  if (!bucket.allowed) return rateLimitResponse(bucket.retryAfterSeconds);

  try {
    const options = await generateAuthenticationOptions({
      rpID: getPasskeyRpId(),
      userVerification: 'preferred',
    });

    const sessionId = crypto.randomUUID();
    await setLoginPasskeyChallenge(sessionId, options.challenge);
    return NextResponse.json({ ...options, sessionId });
  } catch (error) {
    logEvent('error', 'mobile_passkey_auth_options_get_failed', 'api.mobile.v1.passkeys.auth-options', {
      ip,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { generateRegistrationOptions } from '@simplewebauthn/server';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { getPasskeyRpId } from '@/lib/env.server';
import { mobilePasskeyChallenges } from '../_challengeStore';
import { checkRateLimit, rateLimitResponse } from '@/lib/securityRateLimit';
import { getClientIp, logEvent } from '@/lib/observability';
import { normalizeCredentialIdToBase64URL } from '@/lib/passkeyDbEncoding';

export async function POST(req: Request) {
  const ip = getClientIp(req);

  const ipBucket = checkRateLimit(`mobile-passkeys-register-options:ip:${ip}`, 20, 60_000);
  if (!ipBucket.allowed) return rateLimitResponse(ipBucket.retryAfterSeconds);

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? '').trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: 'Wymagany adres e-mail' }, { status: 400 });
    }

    const idBucket = checkRateLimit(`mobile-passkeys-register-options:id:${email}`, 8, 60_000);
    if (!idBucket.allowed) return rateLimitResponse(idBucket.retryAfterSeconds);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: 'Nie znaleziono użytkownika' }, { status: 404 });
    }

    const authenticators = await prisma.authenticator.findMany({ where: { userId: user.id } });

    const excludeCredentials = authenticators.map((auth) => ({
      id: normalizeCredentialIdToBase64URL(auth.credentialID),
      type: 'public-key' as const,
    }));

    const options = await generateRegistrationOptions({
      rpName: 'EstateOS',
      rpID: getPasskeyRpId(),
      userID: new Uint8Array(Buffer.from(user.id.toString())),
      userName: user.email,
      attestationType: 'none',
      excludeCredentials,
      authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
    });

    const sessionId = crypto.randomUUID();
    mobilePasskeyChallenges.set(sessionId, options.challenge);

    await prisma.user.update({ where: { id: user.id }, data: { otpCode: options.challenge } });

    return NextResponse.json({ ...options, sessionId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logEvent('error', 'mobile_passkey_register_options_failed', 'api.mobile.v1.passkeys.register-options', {
      ip,
      error: message,
    });
    console.error('[MOBILE PASSKEY REGISTER OPTIONS ERROR]', error);
    return NextResponse.json({ error: 'Nie udało się przygotować Passkey' }, { status: 500 });
  }
}

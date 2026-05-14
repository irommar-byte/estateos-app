import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signMobileToken } from '@/lib/jwtMobile';
import { mobilePasskeyChallenges } from '../_challengeStore';
import { checkRateLimit, rateLimitResponse } from '@/lib/securityRateLimit';
import { getClientIp, logEvent } from '@/lib/observability';
import { getPasskeyOrigin, getPasskeyRpId } from '@/lib/env.server';

export async function POST(req: Request) {
  const ip = getClientIp(req);

  try {
    const body = await req.json().catch(() => ({}));
    const response = body?.response || body?.credential || body?.assertion || body;
    const sessionId = String(body?.sessionId || body?.challengeId || '').trim();
    const rawCredentialId = String(response?.id || response?.rawId || '').trim();

    const ipBucket = checkRateLimit(`mobile-passkeys-auth-verify:ip:${ip}`, 25, 60_000);
    if (!ipBucket.allowed) return rateLimitResponse(ipBucket.retryAfterSeconds);

    if (!rawCredentialId) {
      return NextResponse.json({ error: 'Brak credential id' }, { status: 400 });
    }

    const base64urlId = (() => {
      try {
        if (rawCredentialId.includes('-') || rawCredentialId.includes('_')) return rawCredentialId;
        return Buffer.from(rawCredentialId, 'base64').toString('base64url');
      } catch {
        return rawCredentialId;
      }
    })();

    const auth =
      (await prisma.authenticator.findFirst({ where: { credentialID: rawCredentialId } })) ||
      (await prisma.authenticator.findFirst({ where: { credentialID: base64urlId } }));

    if (!auth) {
      return NextResponse.json({ error: 'Nieznany klucz' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: auth.userId } });
    if (!user) {
      return NextResponse.json({ error: 'Nie znaleziono użytkownika' }, { status: 404 });
    }

    const userBucket = checkRateLimit(`mobile-passkeys-auth-verify:user:${user.id}`, 12, 60_000);
    if (!userBucket.allowed) return rateLimitResponse(userBucket.retryAfterSeconds);

    const expectedChallenge = user.otpCode || (sessionId ? mobilePasskeyChallenges.get(sessionId) || null : null);
    if (!expectedChallenge) {
      return NextResponse.json({ error: 'Brak wyzwania' }, { status: 400 });
    }

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: getPasskeyOrigin(),
      expectedRPID: getPasskeyRpId(),
      credential: {
        id: auth.credentialID,
        publicKey: (() => {
          try {
            const asUrl = new Uint8Array(Buffer.from(auth.credentialPublicKey, 'base64url'));
            if (asUrl.byteLength) return asUrl;
          } catch {}
          return new Uint8Array(Buffer.from(auth.credentialPublicKey, 'base64'));
        })(),
        counter: auth.counter,
      },
    });

    if (!verification.verified) {
      return NextResponse.json({ error: 'Weryfikacja nie powiodła się' }, { status: 400 });
    }

    try {
      await prisma.authenticator.update({
        where: { userId_credentialID: { userId: user.id, credentialID: auth.credentialID } },
        data: { counter: verification.authenticationInfo.newCounter },
      });
    } catch {
      // no-op: keep login functional if counter update fails
    }

    await prisma.user.update({ where: { id: user.id }, data: { otpCode: null } });
    if (sessionId) mobilePasskeyChallenges.delete(sessionId);

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, role: user.role, name: user.name, image: user.image },
      token: signMobileToken({ id: user.id, email: user.email, role: user.role, credentialId: auth.credentialID }),
      credentialId: auth.credentialID,
    });
  } catch (error) {
    logEvent('error', 'mobile_passkey_auth_verify_failed', 'api.mobile.v1.passkeys.auth-verify', {
      ip,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

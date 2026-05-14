import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encryptSession } from '@/lib/sessionUtils';
import { checkRateLimit, rateLimitResponse } from '@/lib/securityRateLimit';
import { getClientIp, logEvent } from '@/lib/observability';
import { getPasskeyOrigin, getPasskeyRpId } from '@/lib/env.server';

export async function POST(req: Request) {
  const ip = getClientIp(req);

  try {
    const body = await req.json();

    const ipBucket = checkRateLimit(`web-passkeys-auth-verify:ip:${ip}`, 25, 60_000);
    if (!ipBucket.allowed) {
      return rateLimitResponse(ipBucket.retryAfterSeconds);
    }

    const cookieStore = await cookies();
    const expectedChallenge = cookieStore.get('passkey_auth_challenge')?.value;

    if (!expectedChallenge) {
      return NextResponse.json({ error: 'Sesja wygasła' }, { status: 400 });
    }

    const normalizeBase64Url = (value: string) => value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    const candidateIds = new Set<string>();
    const addCandidate = (value: unknown) => {
      const str = String(value || '').trim();
      if (!str) return;
      candidateIds.add(str);
      candidateIds.add(normalizeBase64Url(str));
      try { const asUrl = Buffer.from(str, 'base64').toString('base64url'); if (asUrl) candidateIds.add(asUrl); } catch {}
      try { const asB64 = Buffer.from(str, 'base64url').toString('base64'); if (asB64) candidateIds.add(asB64); } catch {}
    };

    addCandidate(body?.id);
    addCandidate(body?.rawId);

    const credList = Array.from(candidateIds).filter(Boolean);
    const authenticator = credList.length
      ? await prisma.authenticator.findFirst({ where: { credentialID: { in: credList } } })
      : null;

    if (!authenticator) {
      return NextResponse.json({ error: 'Nieznany klucz biometryczny' }, { status: 404 });
    }

    const user = await prisma.user.findUnique({ where: { id: authenticator.userId } });
    if (!user) return NextResponse.json({ error: 'Nie znaleziono użytkownika' }, { status: 404 });

    const userBucket = checkRateLimit(`web-passkeys-auth-verify:user:${user.id}`, 12, 60_000);
    if (!userBucket.allowed) {
      return rateLimitResponse(userBucket.retryAfterSeconds);
    }

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: getPasskeyOrigin(),
      expectedRPID: getPasskeyRpId(),
      credential: {
        id: authenticator.credentialID,
        publicKey: (() => {
          try {
            const asUrl = new Uint8Array(Buffer.from(authenticator.credentialPublicKey, 'base64url'));
            if (asUrl.byteLength) return asUrl;
          } catch {}
          return new Uint8Array(Buffer.from(authenticator.credentialPublicKey, 'base64'));
        })(),
        counter: authenticator.counter,
      },
    });

    if (!verification.verified) {
      return NextResponse.json({ error: 'Błąd kryptograficzny' }, { status: 400 });
    }

    await prisma.authenticator.update({
      where: { credentialID: authenticator.credentialID },
      data: { counter: verification.authenticationInfo.newCounter },
    });

    cookieStore.delete('passkey_auth_challenge');

    const sessionPayload = encryptSession({ id: user.id, email: user.email, role: user.role });
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    } as const;
    cookieStore.set('estateos_session', sessionPayload, cookieOptions);
    cookieStore.set('luxestate_user', sessionPayload, cookieOptions);

    return NextResponse.json({ success: true, role: user.role });
  } catch (error) {
    logEvent('error', 'web_passkey_auth_verify_failed', 'api.passkeys.auth-verify', {
      ip,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}

export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { activeChallenges, getRpID } from '../../store';
import { checkRateLimit, rateLimitResponse } from '@/lib/securityRateLimit';
import { getClientIp, logEvent } from '@/lib/observability';
import { credentialPublicKeyToUint8Array } from '@/lib/passkeyDbEncoding';
import {
  buildExpectedPasskeyOrigins,
  extractOriginFromWebAuthnResponse,
} from '@/lib/passkeyOrigins';
import {
  clearPasskeyLoginChallenge,
  getPasskeyLoginChallenge,
} from '@/lib/passkeyChallengeDb';
import { extractAuthenticationResponse } from '@/lib/passkeyMobileRequest';
import { MOBILE_USER_SELECT } from '@/lib/mobileUserShape';
import { shapeMobileUserEntitled } from '@/lib/mobileUserShapeEntitled';
import { userHasRegisteredPasskey } from '@/lib/mobilePasskeyStatus';

export async function POST(req: Request) {
  const ip = getClientIp(req);

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const sessionId = String(body?.sessionId || '').trim();
    const responsePayload = extractAuthenticationResponse(body);

    if (!responsePayload) {
      return NextResponse.json({ error: 'Brak danych Passkey (credential)' }, { status: 400 });
    }

    const bucket = checkRateLimit(`passkey-login-finish:ip:${ip}`, 25, 60_000);
    if (!bucket.allowed) {
      return rateLimitResponse(bucket.retryAfterSeconds);
    }

    const expectedChallenge =
      (sessionId && activeChallenges.get(sessionId)) ||
      (sessionId ? await getPasskeyLoginChallenge(sessionId) : null);

    if (!expectedChallenge) {
      return NextResponse.json({ error: 'Challenge expired', code: 'CHALLENGE_EXPIRED' }, { status: 400 });
    }

    const normalizeBase64Url = (value: string) =>
      value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    const candidateIds = new Set<string>();
    const addCandidate = (value: unknown) => {
      const str = String(value || '').trim();
      if (!str) return;
      candidateIds.add(str);
      candidateIds.add(normalizeBase64Url(str));
      try {
        const asUrl = Buffer.from(str, 'base64').toString('base64url');
        if (asUrl) candidateIds.add(asUrl);
      } catch {
        /* ignore */
      }
      try {
        const asB64 = Buffer.from(str, 'base64url').toString('base64');
        if (asB64) candidateIds.add(asB64);
      } catch {
        /* ignore */
      }
    };

    addCandidate(responsePayload?.id);
    addCandidate(responsePayload?.rawId);

    const credList = Array.from(candidateIds).filter(Boolean);
    const authRecord = credList.length
      ? await prisma.authenticator.findFirst({ where: { credentialID: { in: credList } } })
      : null;

    if (!authRecord) {
      return NextResponse.json({ error: 'Nieznany klucz biometryczny.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: authRecord.userId } });
    if (!user) {
      return NextResponse.json({ error: 'Użytkownik nie istnieje' }, { status: 400 });
    }

    const userBucket = checkRateLimit(`passkey-login-finish:user:${user.id}`, 12, 60_000);
    if (!userBucket.allowed) {
      return rateLimitResponse(userBucket.retryAfterSeconds);
    }

    const publicKeyBytes = credentialPublicKeyToUint8Array(authRecord.credentialPublicKey);
    const parsedOrigin = extractOriginFromWebAuthnResponse(responsePayload);

    const verification = await verifyAuthenticationResponse({
      response: responsePayload,
      expectedChallenge,
      expectedOrigin: buildExpectedPasskeyOrigins(parsedOrigin),
      expectedRPID: getRpID(),
      credential: {
        id: authRecord.credentialID,
        publicKey: publicKeyBytes,
        counter: authRecord.counter,
      },
    });

    if (!verification.verified) {
      return NextResponse.json(
        { error: 'Kryptografia klucza odrzucona', code: 'VERIFICATION_FAILED', origin: parsedOrigin },
        { status: 400 }
      );
    }

    await prisma.authenticator.update({
      where: { credentialID: authRecord.credentialID },
      data: { counter: verification.authenticationInfo.newCounter },
    });

    if (sessionId) {
      activeChallenges.delete(sessionId);
      await clearPasskeyLoginChallenge(sessionId);
    }

    const jwtSecret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
    if (!jwtSecret) {
      logEvent('error', 'passkey_jwt_secret_missing', 'api.passkey.login.finish', { ip });
      return NextResponse.json({ error: 'Brak konfiguracji JWT' }, { status: 500 });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, jwtSecret, {
      expiresIn: '30d',
    });

    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: MOBILE_USER_SELECT,
    });
    const hasPasskey = await userHasRegisteredPasskey(user.id);

    return NextResponse.json({
      token,
      success: true,
      hasPasskey,
      user: profile
        ? { ...await shapeMobileUserEntitled(profile), hasPasskey: true }
        : { id: user.id, email: user.email, hasPasskey: true },
    });
  } catch (error) {
    logEvent('error', 'passkey_login_finish_failed', 'api.passkey.login.finish', {
      ip,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

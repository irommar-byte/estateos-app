export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { activeChallenges, getOrigin, getRpID } from '../../store';
import { checkRateLimit, rateLimitResponse } from '@/lib/securityRateLimit';
import { getClientIp, logEvent } from '@/lib/observability';
import { credentialPublicKeyToUint8Array } from '@/lib/passkeyDbEncoding';

export async function POST(req: Request) {
  const ip = getClientIp(req);

  try {
    const body = await req.json();
    const { sessionId, ...assertion } = body;

    const bucket = checkRateLimit(`passkey-login-finish:ip:${ip}`, 25, 60_000);
    if (!bucket.allowed) {
      return rateLimitResponse(bucket.retryAfterSeconds);
    }

    const expectedChallenge = activeChallenges.get(sessionId);
    if (!expectedChallenge) {
      return NextResponse.json({ error: 'Challenge expired' }, { status: 400 });
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

    addCandidate(assertion.id);
    addCandidate(assertion.rawId);

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

    const verification = await verifyAuthenticationResponse({
      response: assertion,
      expectedChallenge,
      expectedOrigin: getOrigin(),
      expectedRPID: getRpID(),
      credential: {
        id: authRecord.credentialID,
        publicKey: publicKeyBytes,
        counter: authRecord.counter,
      },
    });

    if (!verification.verified) {
      return NextResponse.json({ error: 'Kryptografia klucza odrzucona' }, { status: 400 });
    }

    await prisma.authenticator.update({
      where: { credentialID: authRecord.credentialID },
      data: { counter: verification.authenticationInfo.newCounter },
    });

    activeChallenges.delete(sessionId);

    const jwtSecret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
    if (!jwtSecret) {
      logEvent('error', 'passkey_jwt_secret_missing', 'api.passkey.login.finish', { ip });
      return NextResponse.json({ error: 'Brak konfiguracji JWT' }, { status: 500 });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, jwtSecret, { expiresIn: '30d' });
    const { password: _omit, ...safeUser } = user as typeof user & { password?: string | null };

    return NextResponse.json({ token, user: safeUser });
  } catch (error) {
    logEvent('error', 'passkey_login_finish_failed', 'api.passkey.login.finish', {
      ip,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

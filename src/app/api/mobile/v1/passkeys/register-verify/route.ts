import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPasskeyOrigin, getPasskeyRpId } from '@/lib/env.server';
import { mobilePasskeyChallenges } from '../_challengeStore';
import { encodeCredentialPublicKeyForDb } from '@/lib/passkeyDbEncoding';

function decodeClientDataJsonBase64(value: string): any | null {
  if (!value) return null;
  try {
    const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'));
  } catch {
    return null;
  }
}

function extractOriginFromResponse(response: any): string | null {
  const candidate =
    response?.clientDataJSON ??
    response?.response?.clientDataJSON ??
    response?.rawResponse?.clientDataJSON ??
    null;
  if (!candidate || typeof candidate !== 'string') return null;
  const clientData = decodeClientDataJsonBase64(candidate);
  const origin = String(clientData?.origin || '').trim();
  return origin || null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? '').trim().toLowerCase();
    const response = body?.response;
    const sessionId = String(body?.sessionId ?? '').trim();

    if (!email || !response) {
      return NextResponse.json({ error: 'Brak danych rejestracji' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    const storedChallenge = user?.otpCode || null;
    const sessionChallenge = sessionId ? mobilePasskeyChallenges.get(sessionId) || null : null;
    const expectedChallenge = storedChallenge || sessionChallenge;

    if (!user || !expectedChallenge) {
      return NextResponse.json({ error: 'Brak wyzwania' }, { status: 400 });
    }

    const configuredOrigin = String(getPasskeyOrigin() || '').replace(/\/$/, '');
    const parsedOrigin = extractOriginFromResponse(response);
    const originCandidates = new Set<string>();
    if (configuredOrigin) originCandidates.add(configuredOrigin);
    if (parsedOrigin) originCandidates.add(parsedOrigin);
    if (process.env.NODE_ENV === 'production') {
      originCandidates.add('https://estateos.pl');
      originCandidates.add('https://www.estateos.pl');
    } else {
      originCandidates.add('http://localhost:3000');
    }
    const expectedOrigin =
      originCandidates.size > 1 ? Array.from(originCandidates) : Array.from(originCandidates)[0];

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: getPasskeyRpId(),
      requireUserVerification: false,
    });

    if (verification.verified && verification.registrationInfo) {
      const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
      const credentialID = credential.id;
      const credentialPublicKey = credential.publicKey;
      const counter = credential.counter;

      const publicKeyDb = encodeCredentialPublicKeyForDb(Buffer.from(credentialPublicKey));

      await prisma.authenticator.upsert({
        where: { credentialID },
        update: {
          credentialPublicKey: publicKeyDb,
          counter,
          credentialDeviceType,
          credentialBackedUp,
          providerAccountId: 'passkey',
          userId: user.id,
        },
        create: {
          credentialID,
          credentialPublicKey: publicKeyDb,
          counter,
          credentialDeviceType,
          credentialBackedUp,
          providerAccountId: 'passkey',
          userId: user.id,
        },
      });

      await prisma.user.update({ where: { id: user.id }, data: { otpCode: null } });
      if (sessionId) mobilePasskeyChallenges.delete(sessionId);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Weryfikacja nie powiodła się' }, { status: 400 });
  } catch (error: unknown) {
    console.error('[MOBILE PASSKEY REGISTER VERIFY ERROR]', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

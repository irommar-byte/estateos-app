export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { activeChallenges, rpName, getRpID } from '../../store';
import jwt from 'jsonwebtoken';
import { verifyMobileToken } from '@/lib/jwtMobile';
import { prisma } from '@/lib/prisma';
import { normalizeCredentialIdToBase64URL } from '@/lib/passkeyDbEncoding';
import { savePasskeyRegisterChallenge } from '@/lib/passkeyChallengeDb';
import {
  formatPasskeyRegistrationOptionsForClient,
  passkeyAlreadyRegisteredPayload,
} from '@/lib/passkeyRegisterOptionsResponse';
import { userHasRegisteredPasskey } from '@/lib/mobilePasskeyStatus';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Brak tokena' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Brak tokena' }, { status: 401 });
    }

    let decoded: Record<string, unknown> | null = verifyMobileToken(token) as Record<string, unknown> | null;
    if (!decoded) {
      const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
      if (secret) {
        try {
          decoded = jwt.verify(token, secret) as Record<string, unknown>;
        } catch {
          decoded = jwt.decode(token) as Record<string, unknown> | null;
        }
      } else {
        decoded = jwt.decode(token) as Record<string, unknown> | null;
      }
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const userId = Number(body?.userId ?? decoded?.id ?? decoded?.userId);
    const emailFromBody = String(body?.email ?? '').trim().toLowerCase();
    const forceNew = Boolean(body?.forceNew ?? body?.force);

    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ error: 'Brak userId' }, { status: 400 });
    }

    if (String(decoded?.id ?? decoded?.userId) !== String(userId)) {
      return NextResponse.json({ error: 'Unauthorized userId mismatch' }, { status: 403 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'Nie znaleziono użytkownika' }, { status: 404 });
    }

    const email = emailFromBody || user.email;

    if ((await userHasRegisteredPasskey(userId)) && !forceNew) {
      return NextResponse.json(passkeyAlreadyRegisteredPayload(userId, email));
    }

    const authenticators = await prisma.authenticator.findMany({
      where: { userId },
      select: { credentialID: true },
    });

    const options = await generateRegistrationOptions({
      rpName,
      rpID: getRpID(),
      userID: new Uint8Array(Buffer.from(user.id.toString())),
      userName: email,
      timeout: 120000,
      attestationType: 'none',
      excludeCredentials: authenticators.map((a) => ({
        id: normalizeCredentialIdToBase64URL(a.credentialID),
        type: 'public-key' as const,
      })),
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'preferred',
        residentKey: 'preferred',
      },
    });

    activeChallenges.set(String(userId), options.challenge);
    await savePasskeyRegisterChallenge(userId, options.challenge);

    return NextResponse.json(
      formatPasskeyRegistrationOptionsForClient(options, { sessionId: String(userId) })
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[PASSKEY REGISTER START ERROR]', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

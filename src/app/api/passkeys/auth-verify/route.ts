import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encryptSession } from '@/lib/sessionUtils';
import { applyEstateosSessionCookie } from '@/lib/passwordAuth';

export const runtime = 'nodejs';

function parseTransports(raw: string | null): string[] | undefined {
  if (!raw) return undefined;
  const s = raw.trim();
  if (!s) return undefined;
  try {
    const j = JSON.parse(s) as unknown;
    if (Array.isArray(j)) return j.map(String).filter(Boolean);
  } catch {
    /* ignore */
  }
  const parts = s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  return parts.length ? parts : undefined;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const cookieStore = await cookies();
    const expectedChallenge = cookieStore.get('passkey_auth_challenge')?.value;
    if (!expectedChallenge) {
      return NextResponse.json({ error: 'Brak wyzwania logowania (odśwież stronę).' }, { status: 400 });
    }

    const credentialId = String(body?.id || '');
    if (!credentialId) {
      return NextResponse.json({ error: 'Brak identyfikatora klucza' }, { status: 400 });
    }

    const authenticator = await prisma.authenticator.findFirst({
      where: { credentialID: credentialId },
      include: { user: true },
    });

    if (!authenticator?.user) {
      return NextResponse.json({ error: 'Nieznany klucz' }, { status: 404 });
    }

    const expectedOrigin =
      process.env.NODE_ENV === 'production'
        ? ['https://estateos.pl', 'https://www.estateos.pl']
        : ['http://localhost:3000', 'http://127.0.0.1:3000'];

    const transports = parseTransports(authenticator.transports);

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: process.env.NODE_ENV === 'production' ? 'estateos.pl' : 'localhost',
      credential: {
        id: authenticator.credentialID,
        publicKey: Buffer.from(authenticator.credentialPublicKey, 'base64url'),
        counter: authenticator.counter,
        ...(transports?.length ? { transports } : {}),
      },
      requireUserVerification: false,
    });

    if (!verification.verified) {
      return NextResponse.json({ error: 'Weryfikacja nie powiodła się' }, { status: 400 });
    }

    const newCounter = verification.authenticationInfo.newCounter;

    await prisma.authenticator.update({
      where: { credentialID: authenticator.credentialID },
      data: { counter: newCounter },
    });

    cookieStore.delete('passkey_auth_challenge');

    const user = authenticator.user;
    const sessionToken = encryptSession({ id: user.id, email: user.email });
    const res = NextResponse.json({ success: true, role: user.role });
    applyEstateosSessionCookie(res, sessionToken);
    return res;
  } catch (error) {
    console.error('passkeys auth-verify', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}

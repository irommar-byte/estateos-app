import { generateRegistrationOptions } from '@simplewebauthn/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { decryptSession } from '@/lib/sessionUtils';
import { prisma } from '@/lib/prisma';
import { loadUserFromEstateosSessionPayload } from '@/lib/loadUserFromEstateosSession';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('estateos_session')?.value;
    if (!sessionCookie) return NextResponse.json({ error: 'Brak sesji' }, { status: 401 });

    const session = decryptSession(sessionCookie);
    const user = await loadUserFromEstateosSessionPayload(session);
    if (!user) return NextResponse.json({ error: 'Błąd sesji' }, { status: 401 });

    const authenticators = await prisma.authenticator.findMany({ where: { userId: user.id } });

    const options = await generateRegistrationOptions({
      rpName: 'EstateOS',
      rpID: process.env.NODE_ENV === 'production' ? 'estateos.pl' : 'localhost',
      userID: new Uint8Array(Buffer.from(user.id.toString())),
      userName: user.email,
      attestationType: 'none',
      excludeCredentials: authenticators.map((auth) => ({
        id: auth.credentialID,
        type: 'public-key' as const,
      })),
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'preferred',
      },
    });

    const secure = process.env.NODE_ENV === 'production';
    cookieStore.set('passkey_challenge', options.challenge, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      maxAge: 60 * 5,
      path: '/',
    });

    return NextResponse.json(options);
  } catch (error) {
    console.error('Błąd generowania Passkey:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}

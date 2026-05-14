import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Rozpoczęcie logowania Passkey (discoverable credentials) — bez wcześniejszej sesji.
 */
export async function GET() {
  try {
    const rpID = process.env.NODE_ENV === 'production' ? 'estateos.pl' : 'localhost';
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'preferred',
    });

    const cookieStore = await cookies();
    const secure = process.env.NODE_ENV === 'production';
    cookieStore.set('passkey_auth_challenge', options.challenge, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 5,
    });

    return NextResponse.json(options);
  } catch (error) {
    console.error('passkeys auth-options', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}

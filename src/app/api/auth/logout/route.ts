import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Bezpieczne wylogowanie' });

  const cookiesToKill = [
    'estateos_session',
    'luxestate_user',
    'deal_token',
    'token',
    'passkey_challenge',
    'passkey_auth_challenge',
    'next-auth.session-token',
    'next-auth.csrf-token',
    'next-auth.callback-url',
    '__Secure-next-auth.session-token',
    '__Host-next-auth.csrf-token',
  ];

  const secure = process.env.NODE_ENV === 'production';

  cookiesToKill.forEach((name) => {
    response.cookies.set(name, '', {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  });

  return response;
}

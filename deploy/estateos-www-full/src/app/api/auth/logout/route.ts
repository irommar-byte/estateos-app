import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true, loggedOut: true, message: 'Wylogowano' });

  const cookiesToKill = [
    'estateos_session',
    'luxestate_user',
    'deal_token',
    'token',
    'next-auth.session-token',
    '__Secure-next-auth.session-token',
    'next-auth.csrf-token',
    '__Host-next-auth.csrf-token',
  ];

  cookiesToKill.forEach((name) => {
    response.cookies.set(name, '', {
      httpOnly: !name.includes('deal_token') && !name.includes('csrf'),
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  });

  return response;
}
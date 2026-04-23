import { NextResponse } from 'next/server';

export async function POST() {
  // 1. Tworzymy obiekt odpowiedzi jako pierwszy
  const response = NextResponse.json({ success: true, message: "Bezpieczne wylogowanie" });

  // 2. Lista wszystkich Twoich tajnych certyfikatów i tokenów
  const cookiesToKill = ['estateos_session', 'luxestate_user', 'deal_token', 'token', 'next-auth.session-token'];

  // 3. Twarde nadpisanie bezpośrednio w nagłówku odpowiedzi HTTP
  cookiesToKill.forEach(name => {
    response.cookies.set(name, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0 // 0 = natychmiastowa śmierć ciastka w przeglądarce
    });
  });

  return response;
}
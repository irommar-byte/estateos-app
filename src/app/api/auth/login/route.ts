import { NextResponse } from 'next/server';
import {
  applyEstateosSessionCookie,
  authenticatePasswordForRequest,
  jsonWithOptionalRateLimit,
} from '@/lib/passwordAuth';

export const runtime = 'nodejs';

/**
 * Kanoniczne logowanie hasłem dla UI (login, OTP) — zwraca `role` i ustawia `estateos_session`.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Niepoprawne żądanie.' }, { status: 400 });
  }

  const result = await authenticatePasswordForRequest(req, body);
  if (!result.ok) {
    return jsonWithOptionalRateLimit(result);
  }

  const res = NextResponse.json({
    success: true,
    role: result.user.role,
  });
  applyEstateosSessionCookie(res, result.sessionToken);
  return res;
}

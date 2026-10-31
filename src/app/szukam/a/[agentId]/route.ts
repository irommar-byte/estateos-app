import { NextResponse } from 'next/server';
import { BUYER_AGENT_COOKIE } from '@/lib/buyerIntake.server';

export const dynamic = 'force-dynamic';

/** Dawny link z numerem agenta — już nie przypisuje kupującego (zastąpiony przez /szukam/s/{kod}). */
export async function GET() {
  const res = new NextResponse(null, { status: 307, headers: { Location: '/szukam' } });
  res.cookies.delete(BUYER_AGENT_COOKIE);
  return res;
}

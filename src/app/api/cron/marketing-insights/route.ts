import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { refreshPageStats } from '@/lib/crm/facebookPromotion';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 120;

function isAuthorized(req: Request): boolean {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || process.env.JWT_SECRET || '';
  if (!secret) return false;
  const actual = Buffer.from(req.headers.get('authorization') || '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Co 3 godziny: statystyki postów na stronach firm (wyświetlenia, reakcje, komentarze, udostępnienia). */
async function run(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const result = await refreshPageStats({ limit: 120 });
  return NextResponse.json({ success: true, ...result });
}

export const GET = run;
export const POST = run;

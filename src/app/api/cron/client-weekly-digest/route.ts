import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { runWeeklyDigest } from '@/lib/crm/weeklyDigest';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 120;

function isAuthorized(req: Request): boolean {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || process.env.JWT_SECRET || '';
  if (!secret) return false;
  const a = Buffer.from(req.headers.get('authorization') || '');
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function run(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const result = await runWeeklyDigest();
  return NextResponse.json({ ok: true, ...result });
}

export const GET = run;
export const POST = run;

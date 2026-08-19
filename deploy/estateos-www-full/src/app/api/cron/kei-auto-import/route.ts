import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { tickKeiAutoImport } from '@/lib/keiAutoImport';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

function cronSecret(): string {
  return process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || process.env.JWT_SECRET || '';
}

function isAuthorized(req: Request): boolean {
  const secret = cronSecret();
  if (!secret) return false;
  const header = req.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function runTick() {
  const tick = await tickKeiAutoImport();
  return NextResponse.json({ ok: true, ...tick });
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  return runTick();
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  return runTick();
}

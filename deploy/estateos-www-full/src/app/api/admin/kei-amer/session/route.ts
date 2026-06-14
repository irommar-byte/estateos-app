import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { ensureKeiAmerSession } from '@/lib/keiAmerClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const admin = await requireAdmin();
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'Brak uprawnień administratora.' }, { status: 401 });
  }

  const session = await ensureKeiAmerSession();
  return NextResponse.json({
    ok: session.ok,
    loggedIn: session.ok,
    message: session.message,
  });
}

export async function POST() {
  const admin = await requireAdmin();
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'Brak uprawnień administratora.' }, { status: 401 });
  }

  const session = await ensureKeiAmerSession(true);
  return NextResponse.json({
    ok: session.ok,
    loggedIn: session.ok,
    message: session.message,
  }, { status: session.ok ? 200 : 502 });
}

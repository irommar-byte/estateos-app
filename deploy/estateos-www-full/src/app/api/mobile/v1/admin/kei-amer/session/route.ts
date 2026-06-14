import { NextResponse } from 'next/server';
import { requireMobileAdmin } from '@/lib/mobileAdminAuth';
import { ensureKeiAmerSession } from '@/lib/keiAmerClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;

  const session = await ensureKeiAmerSession();
  return NextResponse.json({
    ok: session.ok,
    loggedIn: session.ok,
    message: session.message,
  });
}

export async function POST(req: Request) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;

  const session = await ensureKeiAmerSession(true);
  return NextResponse.json(
    {
      ok: session.ok,
      loggedIn: session.ok,
      message: session.message,
    },
    { status: session.ok ? 200 : 502 },
  );
}

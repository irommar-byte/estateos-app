import { NextResponse } from 'next/server';
import { requireMobileAdmin } from '@/lib/mobileAdminAuth';
import { listKeiTargetUserOptions } from '@/lib/keiAutoImport';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;
  const q = new URL(req.url).searchParams.get('q') || '';
  return NextResponse.json({ ok: true, users: await listKeiTargetUserOptions(q) });
}

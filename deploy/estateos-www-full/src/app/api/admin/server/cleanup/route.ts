import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { previewSafeCleanup, runSafeCleanup } from '@/lib/adminServerOps';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const preview = await previewSafeCleanup();
    return NextResponse.json({ ok: true, ...preview }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Błąd podglądu.' },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = (await req.json().catch(() => ({}))) as { paths?: string[] };
    const before = await previewSafeCleanup();
    const result = runSafeCleanup(Array.isArray(body.paths) ? body.paths : undefined);
    const after = await previewSafeCleanup();
    return NextResponse.json({
      ok: true,
      ...result,
      freedEstimate: Math.max(0, before.bytes - after.bytes),
      remainingSafeBytes: after.bytes,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Oczyszczanie nie powiodło się.' },
      { status: 400 },
    );
  }
}

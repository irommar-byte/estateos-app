import { NextResponse } from 'next/server';
import { requireMobileAdmin } from '@/lib/mobileAdminAuth';
import { listImportRegistry } from '@/lib/adminImportRegistry';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get('limit') || 40);
  const offset = Number(url.searchParams.get('offset') || 0);
  const source = url.searchParams.get('source');

  try {
    const result = await listImportRegistry({
      limit: Number.isFinite(limit) ? limit : 40,
      offset: Number.isFinite(offset) ? offset : 0,
      source,
    });
    return NextResponse.json({ success: true, ok: true, ...result });
  } catch (error) {
    console.error('[mobile admin automation imports]', error);
    return NextResponse.json(
      { success: false, ok: false, error: error instanceof Error ? error.message : 'Błąd rejestru importów.' },
      { status: 500 },
    );
  }
}

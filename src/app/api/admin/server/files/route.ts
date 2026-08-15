import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { deleteTargets, enrichDirectorySizes, listFiles } from '@/lib/adminServerOps';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const bucketId = String(url.searchParams.get('bucket') || '').trim();
  const relativePath = String(url.searchParams.get('path') || '').trim();
  const withSizes = url.searchParams.get('sizes') === '1';
  if (!bucketId) return NextResponse.json({ error: 'Brak obszaru.' }, { status: 400 });

  try {
    const listed = listFiles(bucketId, relativePath);
    if (withSizes) await enrichDirectorySizes(listed.entries);
    return NextResponse.json(
      { ok: true, ...listed },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Błąd odczytu.' },
      { status: 400 },
    );
  }
}

export async function DELETE(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = (await req.json()) as { bucket?: string; paths?: string[] };
    const bucketId = String(body.bucket || '').trim();
    const paths = Array.isArray(body.paths) ? body.paths.map(String).filter(Boolean) : [];
    if (!bucketId || paths.length === 0) {
      return NextResponse.json({ error: 'Wybierz pliki do usunięcia.' }, { status: 400 });
    }
    if (paths.length > 80) {
      return NextResponse.json({ error: 'Maksymalnie 80 pozycji naraz.' }, { status: 400 });
    }
    const result = deleteTargets(bucketId, paths);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nie udało się usunąć.' },
      { status: 400 },
    );
  }
}

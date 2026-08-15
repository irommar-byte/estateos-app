import fs from 'fs';
import { Readable } from 'stream';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { resolveDownloadAbsolute, resolveDownloadFile } from '@/lib/adminServerOps';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const areaId = String(url.searchParams.get('area') || url.searchParams.get('bucket') || '').trim();
  const relativePath = String(url.searchParams.get('path') || '').trim();
  const absolute = String(url.searchParams.get('absolute') || '').trim();

  try {
    const file = absolute
      ? resolveDownloadAbsolute(absolute)
      : (() => {
          if (!areaId || !relativePath) throw new Error('Brak ścieżki pliku.');
          return resolveDownloadFile(areaId, relativePath);
        })();
    const nodeStream = fs.createReadStream(file.abs);
    const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
    const encoded = encodeURIComponent(file.name);
    const asciiName = file.name.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
    return new NextResponse(webStream, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(file.size),
        'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encoded}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nie udało się pobrać pliku.' },
      { status: 400 },
    );
  }
}

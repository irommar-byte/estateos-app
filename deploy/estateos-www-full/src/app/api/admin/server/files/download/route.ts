import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { resolveDownloadAbsolute, resolveDownloadFile } from '@/lib/adminServerOps';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

function mimeForName(name: string): string {
  const ext = path.extname(name).toLowerCase();
  switch (ext) {
    case '.mp4':
    case '.m4v':
      return 'video/mp4';
    case '.mov':
      return 'video/quicktime';
    case '.webm':
      return 'video/webm';
    case '.mkv':
      return 'video/x-matroska';
    case '.mp3':
      return 'audio/mpeg';
    case '.m4a':
      return 'audio/mp4';
    case '.wav':
      return 'audio/wav';
    case '.flac':
      return 'audio/flac';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.pdf':
      return 'application/pdf';
    case '.json':
      return 'application/json';
    case '.txt':
    case '.log':
    case '.md':
      return 'text/plain; charset=utf-8';
    case '.csv':
      return 'text/csv; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const areaId = String(url.searchParams.get('area') || url.searchParams.get('bucket') || '').trim();
  const relativePath = String(url.searchParams.get('path') || '').trim();
  const absolute = String(url.searchParams.get('absolute') || '').trim();
  const inline = url.searchParams.get('inline') === '1';

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
    const contentType = mimeForName(file.name);
    const disposition = inline ? 'inline' : 'attachment';
    return new NextResponse(webStream, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(file.size),
        'Content-Disposition': `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encoded}`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Nie udało się pobrać pliku.' },
      { status: 400 },
    );
  }
}

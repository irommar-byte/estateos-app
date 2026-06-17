import { NextResponse } from 'next/server';
import path from 'path';
import { readFile } from 'fs/promises';
import fs from 'fs';
import { AGENCY_UPLOAD_BASE_FS } from '@/lib/upload/agencyBrandingUpload';

export async function GET(_req: Request, context: { params: Promise<{ filename: string }> }) {
  try {
    const { filename } = await context.params;
    const safeName = path.basename(filename);
    if (!safeName || safeName !== filename) {
      return new NextResponse('Nieprawidłowa nazwa pliku', { status: 400 });
    }

    const filePath = path.join(AGENCY_UPLOAD_BASE_FS, safeName);
    if (!fs.existsSync(filePath)) {
      return new NextResponse('Plik nie istnieje', { status: 404 });
    }

    const buffer = await readFile(filePath);
    let mimeType = 'application/octet-stream';
    if (safeName.endsWith('.png')) mimeType = 'image/png';
    else if (safeName.endsWith('.webp')) mimeType = 'image/webp';
    else if (safeName.endsWith('.gif')) mimeType = 'image/gif';
    else if (safeName.endsWith('.jpg') || safeName.endsWith('.jpeg')) mimeType = 'image/jpeg';
    else if (safeName.endsWith('.pdf')) mimeType = 'application/pdf';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('agency upload serve', error);
    return new NextResponse('Błąd serwera plików', { status: 500 });
  }
}

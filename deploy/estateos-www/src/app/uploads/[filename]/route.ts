import { NextResponse } from 'next/server';
import path from 'path';
import { readFile } from 'fs/promises';
import fs from 'fs';

export async function GET(req: Request, context: any) {
  try {
    const resolvedParams = await context.params;
    const filename = resolvedParams.filename;
    
    // Twarde celowanie w folder public/uploads
    const filePath = path.join(process.cwd(), 'public', 'uploads', filename);

    if (!fs.existsSync(filePath)) {
      return new NextResponse('Zdjęcie nie istnieje', { status: 404 });
    }

    const buffer = await readFile(filePath);
    
    let mimeType = 'image/jpeg';
    if (filename.endsWith('.png')) mimeType = 'image/png';
    else if (filename.endsWith('.webp')) mimeType = 'image/webp';
    else if (filename.endsWith('.gif')) mimeType = 'image/gif';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Length': buffer.length.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Błąd serwera plików:', error);
    return new NextResponse('Błąd serwera plików', { status: 500 });
  }
}

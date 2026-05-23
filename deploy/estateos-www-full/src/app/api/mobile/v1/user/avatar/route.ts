import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { getWebFormData } from '@/lib/requestFormData';
import { resolveUploaderUserId } from '@/lib/upload/resolveUploader';

function decodeBase64ImagePayload(raw: string): Buffer {
  let b64 = String(raw || '').trim();
  const dataUrl = /^data:image\/[a-zA-Z+]+;base64,(.+)$/.exec(b64);
  if (dataUrl) b64 = dataUrl[1];
  const buf = Buffer.from(b64, 'base64');
  if (!buf.length || buf.length > 6 * 1024 * 1024) {
    throw new Error('Nieprawidłowy obraz (base64)');
  }
  return buf;
}

export async function POST(req: Request) {
  const contentType = (req.headers.get('content-type') || '').toLowerCase();

  try {
    const authenticatedUserId = await resolveUploaderUserId(req);
    if (!authenticatedUserId) {
      return NextResponse.json({ success: false, error: 'Brak autoryzacji' }, { status: 401 });
    }

    if (contentType.includes('application/json')) {
      const body = await req.json();
      const userId = Number(body?.userId);
      const image = String(body?.image || '');
      if (!Number.isFinite(userId) || userId <= 0 || userId !== authenticatedUserId) {
        return NextResponse.json({ success: false, error: 'Brak uprawnień do edycji avatara' }, { status: 403 });
      }
      if (!image) {
        return NextResponse.json({ success: false, error: 'Brak obrazu' }, { status: 400 });
      }

      const buffer = decodeBase64ImagePayload(image);

      const uploadDir = `/home/rommar/uploads/avatars`;
      fs.mkdirSync(uploadDir, { recursive: true });

      const fileName = `${userId}-${Date.now()}.jpg`;
      const filePath = path.join(uploadDir, fileName);
      fs.writeFileSync(filePath, buffer);

      const publicUrl = `/uploads/avatars/${fileName}`;

      await prisma.user.update({
        where: { id: userId },
        data: { image: publicUrl },
      });

      return NextResponse.json({ success: true, url: publicUrl });
    }

    const formData = await getWebFormData(req);
    const file = formData.get('file') as File;
    const userIdRaw = String(formData.get('userId') || '');
    const userId = Number(userIdRaw);

    if (!file || !Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ success: false, error: 'Brak pliku lub poprawnego ID użytkownika' }, { status: 400 });
    }
    if (userId !== authenticatedUserId) {
      return NextResponse.json({ success: false, error: 'Brak uprawnień do edycji avatara' }, { status: 403 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadDir = `/home/rommar/uploads/avatars`;
    fs.mkdirSync(uploadDir, { recursive: true });

    const fileName = `${authenticatedUserId}-${Date.now()}.jpg`;
    const filePath = path.join(uploadDir, fileName);

    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/uploads/avatars/${fileName}`;

    await prisma.user.update({
      where: { id: authenticatedUserId },
      data: { image: publicUrl },
    });

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Upload awatara nie powiódł się';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

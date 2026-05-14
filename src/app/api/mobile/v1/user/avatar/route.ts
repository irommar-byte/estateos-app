import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { getWebFormData } from '@/lib/requestFormData';
import { verifyMobileToken } from '@/lib/jwtMobile';

function parseBearerUserId(req: Request): number | null {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  const raw = String(auth || '').trim();
  if (!raw.startsWith('Bearer ')) return null;
  const token = raw.slice('Bearer '.length).trim();
  if (!token) return null;
  const payload = verifyMobileToken(token) as Record<string, unknown> | null;
  if (!payload) return null;
  const id = Number(payload.id ?? payload.userId ?? payload.sub);
  return Number.isFinite(id) && id > 0 ? id : null;
}

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
    if (contentType.includes('application/json')) {
      const authUserId = parseBearerUserId(req);
      if (!authUserId) {
        return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
      }

      const body = await req.json();
      const userId = Number(body?.userId);
      const image = String(body?.image || '');
      if (!Number.isFinite(userId) || userId <= 0 || userId !== authUserId) {
        return NextResponse.json({ error: 'Błędny użytkownik' }, { status: 403 });
      }
      if (!image) {
        return NextResponse.json({ error: 'Brak obrazu' }, { status: 400 });
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
    const userId = formData.get('userId') as string;

    if (!file || !userId) {
      return NextResponse.json({ error: 'Brak pliku lub ID usera' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadDir = `/home/rommar/uploads/avatars`;
    fs.mkdirSync(uploadDir, { recursive: true });

    const fileName = `${userId}-${Date.now()}.jpg`;
    const filePath = path.join(uploadDir, fileName);

    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/uploads/avatars/${fileName}`;

    await prisma.user.update({
      where: { id: Number(userId) },
      data: { image: publicUrl },
    });

    return NextResponse.json({ success: true, url: publicUrl });
  } catch (e: unknown) {
    console.error(e);
    const msg = e instanceof Error ? e.message : 'Upload awatara nie powiódł się';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

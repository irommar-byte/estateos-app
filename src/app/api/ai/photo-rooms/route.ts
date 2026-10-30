import { NextResponse } from 'next/server';
import { resolveUploaderUserId } from '@/lib/upload/resolveUploader';
import { loadPhotoBuffer } from '@/lib/buildShareOgJpeg';
import { suggestPhotoRooms } from '@/lib/photoRoomAi';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_IMAGES = 40;
const MAX_DATA_BYTES = 900 * 1024;

/**
 * Podpowiedzi pomieszczeń dla zdjęć: { images: [{ id, url? , dataUrl? }], rooms?: string[] }
 * → { items: [{ id, room, confidence }] }. Agent zatwierdza je jednym kliknięciem.
 */
export async function POST(req: Request) {
  const userId = await resolveUploaderUserId(req);
  if (!userId) return NextResponse.json({ error: 'Brak autoryzacji.' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    images?: Array<{ id?: string; url?: string; dataUrl?: string }>;
    rooms?: string[];
  };
  const list = (Array.isArray(body.images) ? body.images : []).slice(0, MAX_IMAGES);
  const loaded = await Promise.all(
    list.map(async (item, index) => {
      const id = String(item?.id ?? index);
      const dataUrl = String(item?.dataUrl || '');
      if (dataUrl.startsWith('data:image/')) {
        const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
        if (b64.length * 0.75 > MAX_DATA_BYTES) return null;
        return { id, buffer: Buffer.from(b64, 'base64') };
      }
      const url = String(item?.url || '');
      // Tylko zdjęcia z naszego serwera — endpoint nie pobiera dowolnych adresów z internetu.
      if (!/^\/uploads\//.test(url) && !/^https:\/\/(www\.)?estateos\.pl\/uploads\//.test(url)) return null;
      const buffer = await loadPhotoBuffer(url.startsWith('/') ? `https://estateos.pl${url}` : url);
      return buffer ? { id, buffer } : null;
    }),
  );
  const images = loaded.filter((x): x is { id: string; buffer: Buffer } => Boolean(x));
  const rooms = Array.isArray(body.rooms) ? body.rooms.map((r) => String(r || '')).filter(Boolean).slice(0, 20) : [];
  const items = await suggestPhotoRooms(images, rooms);
  return NextResponse.json({ items });
}

import { NextResponse } from 'next/server';
import { getWebFormData } from '@/lib/requestFormData';
import {
  acquireOfferUploadLock,
  MAX_OFFER_FILE_BYTES,
  releaseOfferUploadLock,
  saveOfferGalleryOrFloorplan,
} from '@/lib/upload/offerMediaUpload';
import { resolveUploaderUserId } from '@/lib/upload/resolveUploader';

const requestMap = new Map<string, { count: number; last: number }>();
const RATE_LIMIT = 15;
const RATE_WINDOW = 10_000;
let lastSweep = Date.now();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  if (now - lastSweep > RATE_WINDOW) {
    for (const [key, val] of requestMap.entries()) {
      if (now - val.last > RATE_WINDOW) requestMap.delete(key);
    }
    lastSweep = now;
  }
  const entry = requestMap.get(ip) || { count: 0, last: now };
  if (now - entry.last > RATE_WINDOW) {
    entry.count = 0;
    entry.last = now;
  }
  entry.count++;
  requestMap.set(ip, entry);
  return entry.count <= RATE_LIMIT;
}

export async function POST(req: Request) {
  const ip =
    (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Zbyt wiele zapytań naraz.' },
      { status: 429 }
    );
  }

  const userId = await resolveUploaderUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Brak autoryzacji.' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await getWebFormData(req);
  } catch {
    return NextResponse.json({ error: 'Błąd formularza.' }, { status: 400 });
  }

  const offerIdStr = String(formData.get('offerId') || '');
  if (!offerIdStr) {
    return NextResponse.json({ error: 'Brak ID oferty.' }, { status: 400 });
  }

  const offerId = Number(offerIdStr);
  if (!Number.isFinite(offerId)) {
    return NextResponse.json({ error: 'Błędne ID oferty.' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  const isFloorPlan = String(formData.get('isFloorPlan') || '') === 'true';

  if (!file || typeof file.arrayBuffer !== 'function') {
    return NextResponse.json({ error: 'Brak pliku.' }, { status: 400 });
  }

  if (file.size > MAX_OFFER_FILE_BYTES) {
    return NextResponse.json({ error: 'Plik jest za duży.' }, { status: 413 });
  }

  await acquireOfferUploadLock(offerId);

  try {
    const bytes = await file.arrayBuffer();
    const fileBuffer = Buffer.from(bytes);

    const result = await saveOfferGalleryOrFloorplan({
      offerId,
      ownerUserId: userId,
      fileBuffer,
      mimeTypeDeclared: String(file.type || ''),
      originalFileName: String((file as any).name || ''),
      isFloorPlan,
      byteLengthInput: file.size,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ url: result.url, success: true });
  } catch (e) {
    console.error('❌ UPLOAD ERROR:', e);
    return NextResponse.json({ error: 'Błąd serwera.' }, { status: 500 });
  } finally {
    releaseOfferUploadLock(offerId);
  }
}

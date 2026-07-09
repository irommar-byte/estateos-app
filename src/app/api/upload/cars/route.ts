import { NextResponse } from 'next/server';
import { getWebFormData } from '@/lib/requestFormData';
import { resolveUploaderUserId } from '@/lib/upload/resolveUploader';
import { saveCarListingImage } from '@/lib/upload/carMediaUpload';

const rateByIp = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const row = rateByIp.get(ip);
  if (!row || now > row.resetAt) {
    rateByIp.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (row.count >= MAX_PER_WINDOW) return false;
  row.count += 1;
  return true;
}

export async function POST(req: Request) {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ success: false, error: 'Zbyt wiele prób uploadu.' }, { status: 429 });
  }

  const userId = await resolveUploaderUserId(req);
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Brak autoryzacji.' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await getWebFormData(req);
  } catch {
    return NextResponse.json({ success: false, error: 'Błąd formularza.' }, { status: 400 });
  }

  const file = (formData.get('file') || formData.get('image')) as File | null;
  if (!file || typeof file.arrayBuffer !== 'function') {
    return NextResponse.json({ success: false, error: 'Wybierz plik zdjęcia.' }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await saveCarListingImage({
      buffer,
      mimeTypeDeclared: String(file.type || ''),
      originalFileName: String((file as File & { name?: string }).name || ''),
      userId,
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, url: result.url, path: result.url });
  } catch (e) {
    console.error('cars upload', e);
    return NextResponse.json({ success: false, error: 'Błąd serwera.' }, { status: 500 });
  }
}

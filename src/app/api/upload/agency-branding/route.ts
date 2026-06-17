import { NextResponse } from 'next/server';
import { getWebFormData } from '@/lib/requestFormData';
import { saveAgencyBrandingFile } from '@/lib/upload/agencyBrandingUpload';

const rateByIp = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;

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

/** Publiczny upload loga / dokumentu przy rejestracji biura (bez logowania). */
export async function POST(req: Request) {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ success: false, error: 'Zbyt wiele prób uploadu. Spróbuj za chwilę.' }, { status: 429 });
  }

  let formData: FormData;
  try {
    formData = await getWebFormData(req);
  } catch {
    return NextResponse.json({ success: false, error: 'Błąd formularza.' }, { status: 400 });
  }

  const file = (formData.get('file') || formData.get('logo') || formData.get('document')) as File | null;
  if (!file || typeof file.arrayBuffer !== 'function') {
    return NextResponse.json({ success: false, error: 'Wybierz plik (logo lub dokument).' }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await saveAgencyBrandingFile({
      buffer,
      mimeTypeDeclared: String(file.type || ''),
      originalFileName: String((file as File & { name?: string }).name || ''),
    });
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, url: result.url, mimeType: result.mimeType });
  } catch (e) {
    console.error('agency-branding upload', e);
    return NextResponse.json({ success: false, error: 'Błąd serwera.' }, { status: 500 });
  }
}

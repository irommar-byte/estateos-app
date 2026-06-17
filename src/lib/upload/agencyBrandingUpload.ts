import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { isValidImageMagic } from '@/lib/upload/offerMediaUpload';

export const AGENCY_UPLOAD_BASE_FS =
  process.env.AGENCY_UPLOAD_ROOT || path.join(process.cwd(), 'public', 'uploads', 'agency');

export const AGENCY_UPLOAD_PUBLIC_PREFIX = '/uploads/agency';

export const MAX_AGENCY_BRANDING_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
};

function sniffMime(buffer: Buffer, declared: string, fileName: string): string | null {
  const lower = fileName.toLowerCase();
  if (declared && ALLOWED_MIME.has(declared)) {
    if (declared.startsWith('image/') && isValidImageMagic(buffer, declared)) return declared;
    if (declared === 'application/pdf' && buffer.slice(0, 5).toString('ascii') === '%PDF-') return declared;
  }
  if (isValidImageMagic(buffer, 'image/jpeg') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (isValidImageMagic(buffer, 'image/png') || lower.endsWith('.png')) return 'image/png';
  if (isValidImageMagic(buffer, 'image/webp') || lower.endsWith('.webp')) return 'image/webp';
  if (isValidImageMagic(buffer, 'image/gif') || lower.endsWith('.gif')) return 'image/gif';
  if (buffer.slice(0, 5).toString('ascii') === '%PDF-' || lower.endsWith('.pdf')) return 'application/pdf';
  return null;
}

export async function saveAgencyBrandingFile(params: {
  buffer: Buffer;
  mimeTypeDeclared: string;
  originalFileName?: string;
}): Promise<{ ok: true; url: string; mimeType: string } | { ok: false; status: number; error: string }> {
  if (params.buffer.length === 0) {
    return { ok: false, status: 400, error: 'Pusty plik.' };
  }
  if (params.buffer.length > MAX_AGENCY_BRANDING_BYTES) {
    return { ok: false, status: 413, error: 'Plik jest za duży (max 5 MB).' };
  }

  const mime = sniffMime(
    params.buffer,
    String(params.mimeTypeDeclared || '').trim(),
    String(params.originalFileName || ''),
  );
  if (!mime) {
    return { ok: false, status: 415, error: 'Dozwolone: JPG, PNG, WEBP, GIF lub PDF.' };
  }

  try {
    await fs.mkdir(AGENCY_UPLOAD_BASE_FS, { recursive: true });
  } catch {
    return { ok: false, status: 500, error: 'Nie udało się przygotować katalogu.' };
  }

  const ext = MIME_TO_EXT[mime] || '.bin';
  const fileName = `brand-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
  const filePath = path.join(AGENCY_UPLOAD_BASE_FS, fileName);
  await fs.writeFile(filePath, params.buffer);

  return {
    ok: true,
    url: `${AGENCY_UPLOAD_PUBLIC_PREFIX}/${fileName}`,
    mimeType: mime,
  };
}

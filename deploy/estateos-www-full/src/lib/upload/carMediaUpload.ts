import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { isValidImageMagic, processOfferImageWebp } from '@/lib/upload/offerMediaUpload';

export const CAR_UPLOAD_BASE_FS =
  process.env.CAR_UPLOAD_ROOT || '/home/rommar/uploads/cars';

export const CAR_UPLOAD_PUBLIC_PREFIX = '/uploads/cars';

export const MAX_CAR_IMAGE_BYTES = 12 * 1024 * 1024;

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function sniffMime(buffer: Buffer, declared: string, fileName: string): string | null {
  const lower = fileName.toLowerCase();
  if (declared && ALLOWED_MIME.has(declared) && isValidImageMagic(buffer, declared)) {
    return declared;
  }
  if (isValidImageMagic(buffer, 'image/jpeg') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (isValidImageMagic(buffer, 'image/png') || lower.endsWith('.png')) return 'image/png';
  if (isValidImageMagic(buffer, 'image/webp') || lower.endsWith('.webp')) return 'image/webp';
  if (isValidImageMagic(buffer, 'image/gif') || lower.endsWith('.gif')) return 'image/gif';
  return null;
}

export async function saveCarListingImage(params: {
  buffer: Buffer;
  mimeTypeDeclared: string;
  originalFileName?: string;
  userId: number;
}): Promise<{ ok: true; url: string } | { ok: false; status: number; error: string }> {
  if (params.buffer.length === 0) {
    return { ok: false, status: 400, error: 'Pusty plik.' };
  }
  if (params.buffer.length > MAX_CAR_IMAGE_BYTES) {
    return { ok: false, status: 413, error: 'Plik jest za duży (max 8 MB).' };
  }

  const mime = sniffMime(
    params.buffer,
    String(params.mimeTypeDeclared || '').trim(),
    String(params.originalFileName || ''),
  );
  if (!mime) {
    return { ok: false, status: 415, error: 'Dozwolone: JPG, PNG, WEBP lub GIF.' };
  }

  const userDir = path.join(CAR_UPLOAD_BASE_FS, String(params.userId));
  try {
    await fs.mkdir(userDir, { recursive: true });
  } catch {
    return { ok: false, status: 500, error: 'Nie udało się przygotować katalogu.' };
  }

  let outputBuffer = params.buffer;
  let ext = '.webp';
  try {
    const processed = await processOfferImageWebp(params.buffer, '.jpg', {
      tileWatermark: true,
      quality: 90,
      maxEdge: 2800,
    });
    outputBuffer = processed.buffer;
    ext = processed.ext;
  } catch {
    ext = mime === 'image/png' ? '.png' : mime === 'image/gif' ? '.gif' : '.jpg';
    outputBuffer = params.buffer;
  }

  const fileName = `car-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
  const filePath = path.join(userDir, fileName);
  await fs.writeFile(filePath, outputBuffer);

  return {
    ok: true,
    url: `${CAR_UPLOAD_PUBLIC_PREFIX}/${params.userId}/${fileName}`,
  };
}

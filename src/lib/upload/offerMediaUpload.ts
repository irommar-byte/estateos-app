import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export const OFFER_UPLOAD_BASE_FS =
  process.env.OFFER_UPLOAD_ROOT || '/home/rommar/uploads/offers';

/** Serwowane przez reverse proxy jako prefix dysku `{OFFER_UPLOAD_BASE_FS}/{id}/...`. */
export const OFFER_UPLOAD_PUBLIC_PREFIX = '/uploads/offers';

export const MAX_OFFER_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_OFFER_MEDIA_FOLDER_BYTES = 20 * 1024 * 1024;
export const MAX_IMAGES_PER_OFFER = 20;

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const activeUploads = new Set<number>();

export async function acquireOfferUploadLock(offerId: number) {
  while (activeUploads.has(offerId)) {
    await new Promise((r) => setTimeout(r, 50));
  }
  activeUploads.add(offerId);
}

export function releaseOfferUploadLock(offerId: number) {
  activeUploads.delete(offerId);
}

/** Łączny rozmiar wszystkich plików pod katalogiem oferty (rekurencyjnie). */
export async function getOfferFolderSizeBytes(rootDir: string): Promise<number> {
  let total = 0;
  const walk = async (dir: string) => {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) await walk(p);
      else if (ent.isFile()) {
        try {
          const st = await fs.stat(p);
          total += st.size;
        } catch {
          /* ignore */
        }
      }
    }
  };
  await walk(rootDir);
  return total;
}

export function isValidImageMagic(buffer: Buffer, mime: string): boolean {
  if (buffer.length < 12) return false;
  if (mime === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8;
  if (mime === 'image/png')
    return buffer.slice(0, 8).toString('hex') === '89504e470d0a1a0a';
  if (mime === 'image/webp')
    return (
      buffer.slice(0, 4).toString('ascii') === 'RIFF' &&
      buffer.slice(8, 12).toString('ascii') === 'WEBP'
    );
  if (mime === 'image/gif') {
    const sig = buffer.slice(0, 6).toString('ascii');
    return sig === 'GIF87a' || sig === 'GIF89a';
  }
  return false;
}

export async function processOfferImageWebp(
  buffer: Buffer,
  fallbackExt: string
): Promise<{ buffer: Buffer; ext: string }> {
  try {
    const sharp = (await import('sharp')).default;
    let image = sharp(buffer).rotate();
    const metadata = await image.metadata();

    // Ujednolicenie rozdzielczości zdjęć z telefonów:
    // ograniczamy dłuższy bok, żeby nie marnować limitu 20 MB na kilka gigantycznych kadrów.
    const width = Number(metadata.width || 0);
    const height = Number(metadata.height || 0);
    const maxEdge = 2200;
    if (width > 0 && height > 0 && (width > maxEdge || height > maxEdge)) {
      image = image.resize({
        width: width >= height ? maxEdge : undefined,
        height: height > width ? maxEdge : undefined,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    const svgWatermark = `
      <svg width="520" height="380" xmlns="http://www.w3.org/2000/svg">
        <text x="50%" y="50%" text-anchor="middle" alignment-baseline="middle"
              font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="48"
              fill="rgba(255, 255, 255, 0.20)"
              stroke="rgba(0, 0, 0, 0.08)" stroke-width="1"
              transform="rotate(-25 260 190)">
          EstateOS™
        </text>
      </svg>
    `;

    const watermarkBuffer = await sharp(Buffer.from(svgWatermark)).png().toBuffer();

    image = image.composite([
      {
        input: watermarkBuffer,
        tile: true,
        blend: 'over',
      },
    ]);

    const finalBuffer = await image
      .webp({
        quality: 82,
        effort: 6,
      })
      .toBuffer();
    return { buffer: finalBuffer, ext: '.webp' };
  } catch (e) {
    console.error('❌ offerMediaUpload sharp error:', e);
    return { buffer, ext: fallbackExt };
  }
}

function normalizeMime(declared: string, filename: string): string {
  const d = declared.toLowerCase();
  if (d && d !== 'application/octet-stream') return d;

  const name = filename.toLowerCase();
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.gif')) return 'image/gif';
  if (name.endsWith('.heic') || name.endsWith('.heif')) return 'image/heif';

  return d;
}

/** Rozpoznawanie JPEG/PNG/WebP/GIF/HEIC po sygnaturze — pomaga przy `application/octet-stream` z iOS. */
export function sniffImageMimeFromMagic(buffer: Buffer): string | null {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') return 'image/png';
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  const sig = buffer.subarray(0, 6).toString('ascii');
  if (sig === 'GIF87a' || sig === 'GIF89a') return 'image/gif';
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii').toLowerCase();
    if (
      brand.includes('heic') ||
      brand.includes('heix') ||
      brand.includes('heim') ||
      brand.includes('hevc') ||
      brand === 'mif1' ||
      brand === 'msf1'
    ) {
      return 'image/heic';
    }
  }
  return null;
}

/**
 * Konwersja HEIC/HEIF → bufor pasujący do pipeline (JPEG), jeśli libvips to wspiera.
 */
export async function tryConvertHeifToJpeg(buffer: Buffer): Promise<Buffer | null> {
  try {
    const sharpLib = (await import('sharp')).default;
    return await sharpLib(buffer).rotate().jpeg({ quality: 90 }).toBuffer();
  } catch {
    return null;
  }
}

export async function saveOfferGalleryOrFloorplan(params: {
  offerId: number;
  ownerUserId: number;
  fileBuffer: Buffer;
  mimeTypeDeclared: string;
  originalFileName?: string;
  isFloorPlan: boolean;
  byteLengthInput: number;
}): Promise<
  | { ok: true; url: string }
  | { ok: false; status: number; error: string }
> {
  const mime = normalizeMime(
    params.mimeTypeDeclared,
    params.originalFileName || ''
  );

  if (!ALLOWED_MIME_TYPES.includes(mime as (typeof ALLOWED_MIME_TYPES)[number])) {
    if (mime === 'image/heic' || mime === 'image/heif') {
      const converted = await tryConvertHeifToJpeg(params.fileBuffer);
      if (!converted) {
        return {
          ok: false,
          status: 415,
          error: 'Format HEIC/HEIF nie jest obsługiwany na tym serwerze.',
        };
      }
      return saveOfferGalleryOrFloorplan({
        ...params,
        fileBuffer: converted,
        mimeTypeDeclared: 'image/jpeg',
        byteLengthInput: converted.length,
      });
    }
    return { ok: false, status: 415, error: 'Niedozwolony format pliku.' };
  }

  if (params.byteLengthInput > MAX_OFFER_FILE_BYTES) {
    return { ok: false, status: 413, error: 'Plik jest za duży.' };
  }

  if (!isValidImageMagic(params.fileBuffer, mime)) {
    return { ok: false, status: 400, error: 'Plik uszkodzony lub nie jest obrazem.' };
  }

  const offerCheck = await prisma.offer.findUnique({
    where: { id: params.offerId },
    select: { userId: true },
  });
  if (!offerCheck) return { ok: false, status: 404, error: 'Nie znaleziono oferty.' };
  if (offerCheck.userId !== params.ownerUserId) {
    return { ok: false, status: 403, error: 'Brak uprawnień.' };
  }

  const offer = await prisma.offer.findUnique({
    where: { id: params.offerId },
    select: { images: true, floorPlanUrl: true },
  });
  if (!offer) return { ok: false, status: 404, error: 'Oferta usunięta.' };

  const fallbackExt = MIME_TO_EXT[mime] || '.jpg';
  const { buffer: finalBuffer, ext: finalExt } = await processOfferImageWebp(
    params.fileBuffer,
    fallbackExt
  );

  const offerDir = path.join(OFFER_UPLOAD_BASE_FS, String(params.offerId));
  try {
    await fs.access(offerDir);
  } catch {
    await fs.mkdir(offerDir, { recursive: true });
  }

  const currentSize = await getOfferFolderSizeBytes(offerDir);
  if (currentSize + finalBuffer.length > MAX_OFFER_MEDIA_FOLDER_BYTES) {
    return {
      ok: false,
      status: 400,
      error: 'Brak miejsca dla tej oferty (limit folderu).',
    };
  }

  let existingImages: string[] = [];
  try {
    existingImages = offer.images ? JSON.parse(offer.images) : [];
    if (!Array.isArray(existingImages)) existingImages = [];
  } catch {
    existingImages = [];
  }

  if (
    !params.isFloorPlan &&
    existingImages.length >= MAX_IMAGES_PER_OFFER
  ) {
    return { ok: false, status: 400, error: 'Osiągnięto limit zdjęć.' };
  }

  const fileName = crypto.randomUUID() + finalExt;
  const filePath = path.join(offerDir, fileName);
  await fs.writeFile(filePath, finalBuffer);

  const publicUrl = `${OFFER_UPLOAD_PUBLIC_PREFIX}/${params.offerId}/${fileName}`;

  if (params.isFloorPlan) {
    await prisma.offer.update({
      where: { id: params.offerId },
      data: { floorPlanUrl: publicUrl },
    });
  } else {
    existingImages.push(publicUrl);
    await prisma.offer.update({
      where: { id: params.offerId },
      data: { images: JSON.stringify(existingImages) },
    });
  }

  return { ok: true, url: publicUrl };
}

export async function saveDealroomParticipantWatermarkedImage(params: {
  offerId: number;
  participantUserId: number;
  fileBuffer: Buffer;
  mimeTypeDeclared: string;
  originalFileName?: string;
  byteLengthInput: number;
}): Promise<
  | { ok: true; url: string }
  | { ok: false; status: number; error: string }
> {
  const deal = await prisma.deal.findFirst({
    where: {
      offerId: params.offerId,
      OR: [
        { buyerId: params.participantUserId },
        { sellerId: params.participantUserId },
      ],
    },
    select: { id: true },
  });
  if (!deal) {
    return { ok: false, status: 403, error: 'Brak uprawnień do deal room.' };
  }

  const offerExists = await prisma.offer.findUnique({
    where: { id: params.offerId },
    select: { id: true },
  });
  if (!offerExists) {
    return { ok: false, status: 404, error: 'Nie znaleziono oferty.' };
  }

  const mime = normalizeMime(
    params.mimeTypeDeclared,
    params.originalFileName || ''
  );

  if (!ALLOWED_MIME_TYPES.includes(mime as (typeof ALLOWED_MIME_TYPES)[number])) {
    if (mime === 'image/heic' || mime === 'image/heif') {
      const converted = await tryConvertHeifToJpeg(params.fileBuffer);
      if (!converted) {
        return {
          ok: false,
          status: 415,
          error: 'Format HEIC/HEIF nie jest obsługiwany na tym serwerze.',
        };
      }
      return saveDealroomParticipantWatermarkedImage({
        ...params,
        fileBuffer: converted,
        mimeTypeDeclared: 'image/jpeg',
        byteLengthInput: converted.length,
      });
    }
    return { ok: false, status: 415, error: 'Niedozwolony format pliku.' };
  }

  if (params.byteLengthInput > MAX_OFFER_FILE_BYTES) {
    return { ok: false, status: 413, error: 'Plik jest za duży.' };
  }

  if (!isValidImageMagic(params.fileBuffer, mime)) {
    return {
      ok: false,
      status: 400,
      error: 'Plik uszkodzony lub nie jest obrazem.',
    };
  }

  const fallbackExt = MIME_TO_EXT[mime] || '.jpg';
  const { buffer: finalBuffer, ext: finalExt } = await processOfferImageWebp(
    params.fileBuffer,
    fallbackExt
  );

  const offerRoot = path.join(OFFER_UPLOAD_BASE_FS, String(params.offerId));
  try {
    await fs.access(offerRoot);
  } catch {
    await fs.mkdir(offerRoot, { recursive: true });
  }

  const currentSize = await getOfferFolderSizeBytes(offerRoot);
  if (currentSize + finalBuffer.length > MAX_OFFER_MEDIA_FOLDER_BYTES) {
    return {
      ok: false,
      status: 400,
      error: 'Brak miejsca dla tej oferty (limit folderu).',
    };
  }

  const attachDir = path.join(offerRoot, 'attachments');
  try {
    await fs.access(attachDir);
  } catch {
    await fs.mkdir(attachDir, { recursive: true });
  }

  const fileName = `deal-${crypto.randomUUID()}${finalExt}`;
  const filePath = path.join(attachDir, fileName);
  await fs.writeFile(filePath, finalBuffer);

  const publicUrl = `${OFFER_UPLOAD_PUBLIC_PREFIX}/${params.offerId}/attachments/${fileName}`;
  return { ok: true, url: publicUrl };
}

const SAFE_NAME_RE = /[^a-zA-Z0-9._-]+/g;

export async function saveOfferBinaryAttachment(params: {
  offerId: number;
  actorUserId: number;
  buffer: Buffer;
  originalFilename: string;
  maxBytes?: number;
  /** Nie zapisuj do rekordu oferty — tylko plik pod publicznym URL. */
  skipTouchOffer?: boolean;
}): Promise<{ ok: true; url: string } | { ok: false; status: number; error: string }> {
  const maxB = params.maxBytes ?? MAX_OFFER_FILE_BYTES;
  if (params.buffer.length > maxB) {
    return { ok: false, status: 413, error: 'Plik jest za duży.' };
  }

  if (!params.skipTouchOffer) {
    const offer = await prisma.offer.findUnique({
      where: { id: params.offerId },
      select: { userId: true },
    });
    if (!offer) return { ok: false, status: 404, error: 'Nie znaleziono oferty.' };
    if (offer.userId !== params.actorUserId) {
      return { ok: false, status: 403, error: 'Brak uprawnień.' };
    }
  } else {
    const deal = await prisma.deal.findFirst({
      where: {
        offerId: params.offerId,
        OR: [{ buyerId: params.actorUserId }, { sellerId: params.actorUserId }],
      },
      select: { id: true },
    });
    if (!deal) {
      return { ok: false, status: 403, error: 'Brak uprawnień do załącznika.' };
    }
  }

  const offerRoot = path.join(OFFER_UPLOAD_BASE_FS, String(params.offerId));
  try {
    await fs.access(offerRoot);
  } catch {
    await fs.mkdir(offerRoot, { recursive: true });
  }

  const before = await getOfferFolderSizeBytes(offerRoot);
  if (before + params.buffer.length > MAX_OFFER_MEDIA_FOLDER_BYTES) {
    return {
      ok: false,
      status: 400,
      error: 'Brak miejsca dla tej oferty (limit folderu).',
    };
  }

  const offerDir = path.join(OFFER_UPLOAD_BASE_FS, String(params.offerId), 'attachments');
  try {
    await fs.access(offerDir);
  } catch {
    await fs.mkdir(offerDir, { recursive: true });
  }

  const base = path.basename(params.originalFilename || 'file').replace(SAFE_NAME_RE, '_');
  const ext = base.includes('.') ? base.slice(base.lastIndexOf('.')) : '';
  const stem = ext ? base.slice(0, base.lastIndexOf('.')) : base;
  const safeStem = stem.slice(0, 80) || 'attachment';
  const safeExt = ext.length <= 10 ? ext : '';
  const finalName = `${safeStem}-${Date.now()}-${Math.round(Math.random() * 1e4)}${safeExt}`;
  const filePath = path.join(offerDir, finalName);
  await fs.writeFile(filePath, params.buffer);

  const publicUrl = `${OFFER_UPLOAD_PUBLIC_PREFIX}/${params.offerId}/attachments/${finalName}`;
  return { ok: true, url: publicUrl };
}

/**
 * Załącznik w deal room: obrazy przez pipeline ze znakiem wodnym, inne typy jako pliki w attachments/.
 */
export async function saveDealAttachmentForDealRoom(params: {
  dealId: number;
  participantUserId: number;
  fileBuffer: Buffer;
  mimeTypeDeclared: string;
  originalFileName?: string;
}): Promise<{ ok: true; url: string } | { ok: false; status: number; error: string }> {
  const deal = await prisma.deal.findUnique({
    where: { id: params.dealId },
    select: { id: true, offerId: true, buyerId: true, sellerId: true },
  });
  if (!deal) {
    return { ok: false, status: 404, error: 'Nie znaleziono transakcji.' };
  }
  if (
    deal.buyerId !== params.participantUserId &&
    deal.sellerId !== params.participantUserId
  ) {
    return { ok: false, status: 403, error: 'Brak dostępu do deal room.' };
  }

  if (params.fileBuffer.length > MAX_OFFER_FILE_BYTES) {
    return { ok: false, status: 413, error: 'Plik jest za duży (max 15 MB).' };
  }

  const filename = params.originalFileName || '';
  let mime = normalizeMime(params.mimeTypeDeclared || '', filename);

  if (
    !mime ||
    mime === 'application/octet-stream' ||
    mime === 'binary/octet-stream'
  ) {
    const sniffed = sniffImageMimeFromMagic(params.fileBuffer);
    if (sniffed) mime = sniffed;
  }

  const isProcessableImage =
    mime === 'image/heic' ||
    mime === 'image/heif' ||
    (ALLOWED_MIME_TYPES as readonly string[]).includes(mime);

  if (isProcessableImage) {
    return saveDealroomParticipantWatermarkedImage({
      offerId: deal.offerId,
      participantUserId: params.participantUserId,
      fileBuffer: params.fileBuffer,
      mimeTypeDeclared: mime,
      originalFileName: filename,
      byteLengthInput: params.fileBuffer.length,
    });
  }

  return saveOfferBinaryAttachment({
    offerId: deal.offerId,
    actorUserId: params.participantUserId,
    buffer: params.fileBuffer,
    originalFilename:
      filename ||
      (mime && mime !== 'application/octet-stream'
        ? mime.replace(/[/\s]+/g, '_')
        : 'attachment'),
    skipTouchOffer: true,
  });
}

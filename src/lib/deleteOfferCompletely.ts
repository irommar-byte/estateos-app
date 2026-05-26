import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import {
  OFFER_UPLOAD_BASE_FS,
  OFFER_UPLOAD_PUBLIC_PREFIX,
} from '@/lib/upload/offerMediaUpload';

type DeleteOfferResult =
  | { ok: true; deletedId: number }
  | { ok: false; status: number; error: string };

function parseImageUrls(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((item) => String(item || '').trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

async function rmSafe(targetPath: string) {
  try {
    await fs.rm(targetPath, { recursive: true, force: true });
  } catch (error) {
    console.warn('[deleteOfferCompletely] rm failed:', targetPath, error);
  }
}

function localPathsForMediaUrl(url: string, offerId: number): string[] {
  const normalized = String(url || '').trim();
  if (!normalized) return [];

  const paths = new Set<string>();

  if (normalized.startsWith(OFFER_UPLOAD_PUBLIC_PREFIX)) {
    const rel = normalized.slice(OFFER_UPLOAD_PUBLIC_PREFIX.length).replace(/^\//, '');
    paths.add(path.join(OFFER_UPLOAD_BASE_FS, rel));
  }

  if (normalized.startsWith('/uploads/')) {
    paths.add(path.join(process.cwd(), 'public', normalized.replace(/^\//, '')));
  }

  const fileName = path.basename(normalized.split('?')[0] || '');
  if (fileName) {
    paths.add(path.join(process.cwd(), 'public', 'uploads', fileName));
    paths.add(path.join(OFFER_UPLOAD_BASE_FS, String(offerId), fileName));
  }

  return [...paths];
}

async function deleteOfferMediaFiles(params: {
  offerId: number;
  images: string | null;
  floorPlanUrl: string | null;
  videoUrl: string | null;
}) {
  const urls = [
    ...parseImageUrls(params.images),
    params.floorPlanUrl,
    params.videoUrl,
  ].filter(Boolean) as string[];

  await rmSafe(path.join(OFFER_UPLOAD_BASE_FS, String(params.offerId)));

  for (const url of urls) {
    for (const localPath of localPathsForMediaUrl(url, params.offerId)) {
      await rmSafe(localPath);
    }
  }
}

export async function deleteOfferCompletely(offerId: number): Promise<DeleteOfferResult> {
  if (!Number.isFinite(offerId) || offerId <= 0) {
    return { ok: false, status: 400, error: 'Nieprawidłowe ID oferty.' };
  }

  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    select: {
      id: true,
      status: true,
      images: true,
      floorPlanUrl: true,
      videoUrl: true,
    },
  });

  if (!offer) {
    return { ok: false, status: 404, error: 'Oferta nie istnieje.' };
  }

  await prisma.$transaction(async (tx) => {
    await tx.deal.updateMany({
      where: { offerId },
      data: { acceptedBidId: null },
    });

    await tx.$executeRawUnsafe(`DELETE FROM OfferViewLog WHERE offerId = ?`, offerId);
    try {
      await tx.$executeRawUnsafe(`DELETE FROM DiscoveryEvent WHERE offerId = ?`, offerId);
    } catch {
      // tabela opcjonalna w starszych instalacjach
    }

    await tx.offer.delete({ where: { id: offerId } });
  });

  await deleteOfferMediaFiles({
    offerId,
    images: offer.images,
    floorPlanUrl: offer.floorPlanUrl,
    videoUrl: offer.videoUrl,
  });

  return { ok: true, deletedId: offerId };
}

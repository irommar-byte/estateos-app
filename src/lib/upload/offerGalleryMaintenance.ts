import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '@/lib/prisma';
import {
  MAX_IMAGES_PER_OFFER,
  MAX_OFFER_MEDIA_FOLDER_BYTES,
  OFFER_UPLOAD_BASE_FS,
} from '@/lib/upload/offerMediaUpload';
import {
  deleteOfferImageArtifacts,
  parseOfferImagesField,
} from '@/lib/upload/deleteOfferImageArtifacts';

const PHOTO_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic', '.heif']);
const SKIP_DIRS = new Set(['attachments']);
const SKIP_EXTS = new Set(['.usdz', '.glb', '.gltf', '.bin', '.pdf']);

export type OfferMediaQuota = {
  usedBytes: number;
  maxBytes: number;
  remainingBytes: number;
  usedImages: number;
  maxImages: number;
  remainingImages: number;
};

function offerDirFs(offerId: number): string {
  return path.resolve(path.join(OFFER_UPLOAD_BASE_FS, String(offerId)));
}

function stemFromFilename(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/-master$/i, '');
}

function isPhotoQuotaFile(relName: string): boolean {
  const ext = path.extname(relName).toLowerCase();
  if (SKIP_EXTS.has(ext)) return false;
  if (relName.toLowerCase().includes('floorplan-3d')) return false;
  if (ext === '.json') return true;
  return PHOTO_EXTS.has(ext);
}

async function walkPhotoFiles(rootDir: string): Promise<Array<{ abs: string; rel: string; size: number }>> {
  const out: Array<{ abs: string; rel: string; size: number }> = [];
  const walk = async (dir: string, relPrefix: string) => {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const rel = relPrefix ? `${relPrefix}/${ent.name}` : ent.name;
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (SKIP_DIRS.has(ent.name.toLowerCase())) continue;
        await walk(abs, rel);
        continue;
      }
      if (!ent.isFile() || !isPhotoQuotaFile(rel)) continue;
      try {
        const st = await fs.stat(abs);
        out.push({ abs, rel, size: st.size });
      } catch {
        /* ignore */
      }
    }
  };
  await walk(rootDir, '');
  return out;
}

export async function getOfferPhotoQuotaBytes(offerId: number): Promise<number> {
  const files = await walkPhotoFiles(offerDirFs(offerId));
  return files.reduce((sum, f) => sum + f.size, 0);
}

async function loadKeepStems(offerId: number): Promise<{
  gallery: string[];
  keepStems: Set<string>;
  floorPlanUrl: string | null;
  extraFloorPlanUrls: string[];
}> {
  let offer: {
    images: unknown;
    floorPlanUrl: string | null;
    floorPlanExtraUrls?: string | null;
    floorPlan3dUrl?: string | null;
  } | null = null;
  try {
    offer = await prisma.offer.findUnique({
      where: { id: offerId },
      select: {
        images: true,
        floorPlanUrl: true,
        floorPlanExtraUrls: true,
        floorPlan3dUrl: true,
      },
    });
  } catch {
    offer = await prisma.offer.findUnique({
      where: { id: offerId },
      select: { images: true, floorPlanUrl: true },
    });
  }
  const gallery = parseOfferImagesField(offer?.images);
  const extras = parseOfferImagesField(offer?.floorPlanExtraUrls);
  const keepUrls = [
    ...gallery,
    ...extras,
    String(offer?.floorPlanUrl || '').trim(),
    String(offer?.floorPlan3dUrl || '').trim(),
  ].filter(Boolean);
  const keepStems = new Set(keepUrls.map((url) => stemFromFilename(path.basename(url))));
  return {
    gallery,
    keepStems,
    floorPlanUrl: String(offer?.floorPlanUrl || '').trim() || null,
    extraFloorPlanUrls: extras,
  };
}

export async function getOfferMediaQuota(offerId: number): Promise<OfferMediaQuota> {
  const { gallery } = await loadKeepStems(offerId);
  const usedBytes = await getOfferPhotoQuotaBytes(offerId);
  const usedImages = gallery.length;
  return {
    usedBytes,
    maxBytes: MAX_OFFER_MEDIA_FOLDER_BYTES,
    remainingBytes: Math.max(0, MAX_OFFER_MEDIA_FOLDER_BYTES - usedBytes),
    usedImages,
    maxImages: MAX_IMAGES_PER_OFFER,
    remainingImages: Math.max(0, MAX_IMAGES_PER_OFFER - usedImages),
  };
}

/** Usuwa pliki zdjęć, które nie są w galerii ani rzucie — typowy powód „limit folderu” po skasowaniu UI. */
export async function pruneUnreferencedOfferPhotos(offerId: number): Promise<{ deleted: string[] }> {
  const { keepStems } = await loadKeepStems(offerId);
  const files = await walkPhotoFiles(offerDirFs(offerId));
  const deleted: string[] = [];
  for (const file of files) {
    const stem = stemFromFilename(path.basename(file.rel));
    if (keepStems.has(stem)) continue;
    try {
      await fs.unlink(file.abs);
      deleted.push(file.abs);
    } catch {
      /* best-effort */
    }
  }
  return { deleted };
}

export async function removeOfferImageUrlFromRecord(offerId: number, publicUrl: string): Promise<string[]> {
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    select: { images: true },
  });
  const next = parseOfferImagesField(offer?.images).filter((url) => url !== publicUrl);
  await prisma.offer.update({
    where: { id: offerId },
    data: { images: JSON.stringify(next) },
  });
  return next;
}

/** Kasuje całą galerię oferty (pliki + JSON). Rzut i model 3D zostają. */
export async function purgeOfferGallery(offerId: number): Promise<OfferMediaQuota> {
  const { gallery } = await loadKeepStems(offerId);
  for (const url of gallery) {
    try {
      await deleteOfferImageArtifacts(offerId, url);
    } catch {
      /* best-effort per image */
    }
  }
  await prisma.offer.update({
    where: { id: offerId },
    data: { images: JSON.stringify([]) },
  });
  await pruneUnreferencedOfferPhotos(offerId);
  return getOfferMediaQuota(offerId);
}

export async function actorMayManageOfferMedia(offerUserId: number, actorUserId: number): Promise<boolean> {
  if (offerUserId === actorUserId) return true;
  const actor = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { role: true },
  });
  return String(actor?.role || '').toUpperCase() === 'ADMIN';
}

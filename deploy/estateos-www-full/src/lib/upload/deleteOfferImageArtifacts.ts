import { promises as fs } from 'fs';
import path from 'path';
import {
  OFFER_UPLOAD_BASE_FS,
  OFFER_UPLOAD_PUBLIC_PREFIX,
  normalizeOfferPublicUrl,
} from '@/lib/upload/offerMediaUpload';
import { readOfferImageMeta, stemFromPublicUrlForDelete } from '@/lib/upload/offerImageMeta';

const MASTER_SUFFIXES = ['.heic', '.heif', '.jpg', '.jpeg', '.png'] as const;

function offerDirFs(offerId: number): string {
  return path.resolve(path.join(OFFER_UPLOAD_BASE_FS, String(offerId)));
}

/** Validates public URL belongs to offer and returns safe absolute FS path inside offer folder. */
export function resolveOfferImageFsPath(offerId: number, publicUrl: string): string | null {
  const url = normalizeOfferPublicUrl(publicUrl);
  if (!url.startsWith('/')) return null;

  const expectedPrefix = `${OFFER_UPLOAD_PUBLIC_PREFIX}/${offerId}/`;
  if (!url.startsWith(expectedPrefix)) return null;

  const relative = url.slice(expectedPrefix.length);
  if (!relative || relative.includes('..') || relative.includes('\\')) return null;

  const dir = offerDirFs(offerId);
  const abs = path.resolve(path.join(dir, relative));
  if (abs !== dir && !abs.startsWith(`${dir}${path.sep}`)) return null;

  return abs;
}

async function safeUnlink(
  filePath: string,
): Promise<'deleted' | 'missing' | 'skipped'> {
  try {
    await fs.unlink(filePath);
    return 'deleted';
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return 'missing';
    throw e;
  }
}

/**
 * Usuwa SDR/WebP, HDR master i sidecar JSON dla jednego zdjęcia oferty.
 * Bezpieczne gdy pliki już nie istnieją; odrzuca URL spoza folderu oferty.
 */
export async function deleteOfferImageArtifacts(
  offerId: number,
  publicSdrUrl: string,
): Promise<{ deleted: string[]; missing: string[] }> {
  if (!Number.isFinite(offerId) || offerId <= 0) {
    throw new Error('Nieprawidłowe ID oferty.');
  }

  const sdrPath = resolveOfferImageFsPath(offerId, publicSdrUrl);
  if (!sdrPath) {
    throw new Error('URL zdjęcia nie należy do tej oferty.');
  }

  const deleted: string[] = [];
  const missing: string[] = [];

  const track = (result: 'deleted' | 'missing' | 'skipped', p: string) => {
    if (result === 'deleted') deleted.push(p);
    else if (result === 'missing') missing.push(p);
  };

  const meta = await readOfferImageMeta(offerId, publicSdrUrl);

  track(await safeUnlink(sdrPath), sdrPath);

  const masterCandidates = new Set<string>();
  if (meta?.masterUrl) {
    const masterPath = resolveOfferImageFsPath(offerId, meta.masterUrl);
    if (masterPath) masterCandidates.add(masterPath);
  }

  const stem = stemFromPublicUrlForDelete(publicSdrUrl);
  const dir = offerDirFs(offerId);
  for (const ext of MASTER_SUFFIXES) {
    masterCandidates.add(path.join(dir, `${stem}-master${ext}`));
  }

  for (const masterPath of masterCandidates) {
    if (masterPath === sdrPath) continue;
    if (masterPath !== dir && !masterPath.startsWith(`${dir}${path.sep}`)) continue;
    track(await safeUnlink(masterPath), masterPath);
  }

  const metaPath = path.join(dir, 'meta', `${stem}.json`);
  if (metaPath.startsWith(`${dir}${path.sep}`)) {
    track(await safeUnlink(metaPath), metaPath);
  }

  return { deleted, missing };
}

/** Diff listy zdjęć — usuwa artefakty dla URL-i wypadłych z nowej listy. */
export async function deleteRemovedOfferImages(
  offerId: number,
  previousUrls: string[],
  nextUrls: string[],
): Promise<void> {
  const next = new Set(nextUrls.map((u) => String(u).trim()).filter(Boolean));
  for (const url of previousUrls) {
    const trimmed = String(url).trim();
    if (!trimmed || next.has(trimmed)) continue;
    try {
      await deleteOfferImageArtifacts(offerId, trimmed);
    } catch {
      /* best-effort per image */
    }
  }
}

export function parseOfferImagesField(raw: unknown): string[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) {
      return parsed.map((u) => String(u).trim()).filter(Boolean);
    }
    if (typeof parsed === 'string' && parsed.includes(',')) {
      return parsed.split(',').map((u) => u.trim()).filter(Boolean);
    }
  } catch {
    if (typeof raw === 'string' && raw.includes('/uploads/offers/')) {
      return raw.split(',').map((u) => u.trim()).filter(Boolean);
    }
  }
  return [];
}

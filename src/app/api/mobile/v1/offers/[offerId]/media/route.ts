export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/jwtMobile';
import { MAX_IMAGES_PER_OFFER } from '@/lib/upload/offerMediaUpload';
import {
  deleteOfferImageArtifacts,
  deleteRemovedOfferImages,
  parseOfferImagesField,
} from '@/lib/upload/deleteOfferImageArtifacts';
import { getOfferMediaQuota } from '@/lib/upload/offerGalleryMaintenance';

type RouteContext = {
  params: Promise<{ offerId: string }> | { offerId: string };
};

function parseUserIdFromBearer(req: Request): number | null {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth) return null;
  const rawToken = auth.replace(/^Bearer\s+/i, '').trim();
  if (!rawToken) return null;
  const payload = verifyMobileToken(rawToken) as { id?: number; userId?: number; sub?: number };
  const userId = Number(payload?.id ?? payload?.userId ?? payload?.sub);
  return Number.isFinite(userId) && userId > 0 ? userId : null;
}

async function assertOfferEditor(offerId: number, userId: number) {
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    select: { id: true, userId: true, images: true },
  });
  if (!offer) return { ok: false as const, status: 404, error: 'Nie znaleziono oferty.' };

  const actor = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  const isAdmin = String(actor?.role || '').toUpperCase() === 'ADMIN';
  if (!isAdmin && offer.userId !== userId) {
    return { ok: false as const, status: 403, error: 'Brak uprawnień.' };
  }
  return { ok: true as const, offer };
}

function folderStats(quota: {
  usedBytes: number;
  maxBytes: number;
  remainingBytes: number;
  maxImages: number;
}) {
  return {
    usedBytes: quota.usedBytes,
    limitBytes: quota.maxBytes,
    freeBytes: quota.remainingBytes,
    usedMb: Number((quota.usedBytes / (1024 * 1024)).toFixed(2)),
    freeMb: Number((quota.remainingBytes / (1024 * 1024)).toFixed(2)),
    limitMb: Math.round(quota.maxBytes / (1024 * 1024)),
    maxImages: quota.maxImages || MAX_IMAGES_PER_OFFER,
  };
}

/** GET — zajętość folderu mediów oferty (MB użyte / wolne). */
export async function GET(req: Request, context: RouteContext) {
  const params = await context.params;
  const offerId = Number(params.offerId);
  if (!Number.isFinite(offerId) || offerId <= 0) {
    return NextResponse.json({ success: false, error: 'Nieprawidłowe ID oferty.' }, { status: 400 });
  }

  const userId = parseUserIdFromBearer(req);
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Brak autoryzacji.' }, { status: 401 });
  }

  const access = await assertOfferEditor(offerId, userId);
  if (!access.ok) {
    return NextResponse.json({ success: false, error: access.error }, { status: access.status });
  }

  const images = parseOfferImagesField(access.offer.images);
  const quota = await getOfferMediaQuota(offerId);

  return NextResponse.json({
    success: true,
    imageCount: images.length,
    ...folderStats(quota),
  });
}

/**
 * POST — natychmiastowe usunięcie zdjęć z dysku + aktualizacja listy w DB
 * (bez pełnego updateOffer / reapproval — jak upload, który też dopisuje od razu).
 * Body: `{ remove: string[] }` — ścieżki publiczne `/uploads/offers/{id}/...`
 */
export async function POST(req: Request, context: RouteContext) {
  const params = await context.params;
  const offerId = Number(params.offerId);
  if (!Number.isFinite(offerId) || offerId <= 0) {
    return NextResponse.json({ success: false, error: 'Nieprawidłowe ID oferty.' }, { status: 400 });
  }

  const userId = parseUserIdFromBearer(req);
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Brak autoryzacji.' }, { status: 401 });
  }

  const access = await assertOfferEditor(offerId, userId);
  if (!access.ok) {
    return NextResponse.json({ success: false, error: access.error }, { status: access.status });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const removeRaw = body?.remove ?? body?.urls ?? body?.url;
  const toRemove = (Array.isArray(removeRaw) ? removeRaw : [removeRaw])
    .map((u: unknown) => String(u || '').trim())
    .filter(Boolean);

  if (!toRemove.length) {
    return NextResponse.json({ success: false, error: 'Brak URL-i do usunięcia.' }, { status: 400 });
  }

  const previous = parseOfferImagesField(access.offer.images);
  const removeSet = new Set(toRemove);
  const next = previous.filter((url) => !removeSet.has(url));

  // Usuń z dysku nawet URL-e spoza aktualnej listy (np. orphan / plan).
  for (const url of toRemove) {
    try {
      await deleteOfferImageArtifacts(offerId, url);
    } catch {
      /* best-effort */
    }
  }
  await deleteRemovedOfferImages(offerId, previous, next);

  await prisma.offer.update({
    where: { id: offerId },
    data: { images: JSON.stringify(next) },
  });

  const quota = await getOfferMediaQuota(offerId);

  return NextResponse.json({
    success: true,
    images: next,
    imageCount: next.length,
    ...folderStats(quota),
  });
}

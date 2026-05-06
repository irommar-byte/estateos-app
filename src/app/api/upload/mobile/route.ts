import { NextResponse } from 'next/server';
import { getWebFormData } from '@/lib/requestFormData';
import {
  MAX_OFFER_FILE_BYTES,
  acquireOfferUploadLock,
  releaseOfferUploadLock,
  saveDealroomParticipantWatermarkedImage,
  saveOfferBinaryAttachment,
  saveOfferGalleryOrFloorplan,
  sniffImageMimeFromMagic,
} from '@/lib/upload/offerMediaUpload';
import { resolveUploaderUserId } from '@/lib/upload/resolveUploader';
import { prisma } from '@/lib/prisma';

/**
 * Kompatybilność API mobilnego — takie samo krycie jak `/api/upload`
 * (`/uploads/offers/{id}/...`, limity i autoryzacja).
 */
export async function POST(req: Request) {
  try {
    const userId = await resolveUploaderUserId(req);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Brak autoryzacji.' },
        { status: 401 }
      );
    }

    const formData = await getWebFormData(req);
    const file = (formData.get('file') ||
      formData.get('document') ||
      formData.get('attachment')) as File | null;

    const purpose = String(formData.get('purpose') || '').trim();
    let offerIdNum = Number(
      String((formData.get('offerId') || formData.get('listingId') || '') as string || '').trim()
    );

    const dealRoomDealIdNum = Number(
      String(formData.get('dealId') ?? '').trim()
    );

    /*
     * Expo wysyła offerId=myli-z-deal-id gdy lista deali nie ustaliła prawdziwej oferty:
     * `uploadOfferId || dealId` → np. PDF z deal.id=25 ląduje jako offerId=25.
     * Dla dealroomAttachment nadpisz offerId faktycznym offerId transakcji po dealId z formularza.
     */
    if (
      purpose === 'dealroomAttachment' &&
      Number.isFinite(dealRoomDealIdNum) &&
      dealRoomDealIdNum > 0
    ) {
      const drDeal = await prisma.deal.findUnique({
        where: { id: Math.floor(dealRoomDealIdNum) },
        select: { offerId: true, buyerId: true, sellerId: true },
      });
      if (drDeal && (drDeal.buyerId === userId || drDeal.sellerId === userId)) {
        offerIdNum = drDeal.offerId;
      }
    }

    if (
      !file ||
      !(typeof file === 'object' && typeof (file as Blob).arrayBuffer === 'function')
    ) {
      return NextResponse.json(
        { success: false, error: 'Brak pliku lub nieprawidłowa struktura pola pliku.' },
        { status: 400 }
      );
    }

    if (!Number.isFinite(offerIdNum) || offerIdNum <= 0) {
      return NextResponse.json(
        { success: false, error: 'Brak lub błędne ID oferty (ani z pola offerId, ani z dealId nie da się ustalić oferty).' },
        { status: 400 }
      );
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(await file.arrayBuffer());
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : String(e);
      return NextResponse.json(
        { success: false, error: `Nie udało się odczytać treści pliku: ${m}` },
        { status: 400 }
      );
    }

    const blobSizeKnown = typeof (file as Blob & { size?: number }).size === 'number';
    const blobSize = blobSizeKnown ? Number((file as Blob & { size?: number }).size) : buffer.length;

    if (blobSize > MAX_OFFER_FILE_BYTES || buffer.length > MAX_OFFER_FILE_BYTES) {
      return NextResponse.json({ success: false, error: 'Plik jest za duży.' }, { status: 413 });
    }
    if (buffer.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Pusty plik lub brak binariów w polu multipart.' },
        { status: 400 }
      );
    }

    const isFloorPlan = String(formData.get('isFloorPlan') || '') === 'true';
    const mimeType = String(file.type || '');
    const lowerName = String((file as Blob & { name?: string }).name || '').toLowerCase();
    let isImage =
      mimeType.startsWith('image/') ||
      /\.(jpg|jpeg|png|webp|gif|heic|heif)$/i.test(lowerName);
    if (!isImage && (mimeType === 'application/octet-stream' || mimeType === '')) {
      if (sniffImageMimeFromMagic(buffer)) isImage = true;
    }

    const declaredForImagePipeline =
      mimeType && mimeType !== 'application/octet-stream'
        ? mimeType
        : sniffImageMimeFromMagic(buffer) || 'image/jpeg';

    if (!isImage) {
      const att = await saveOfferBinaryAttachment({
        offerId: offerIdNum,
        actorUserId: userId,
        buffer,
        originalFilename:
          lowerName ||
          (mimeType ? mimeType.replace(/\//g, '_') : 'attachment'),
        skipTouchOffer: purpose === 'dealroomAttachment',
      });
      if (!att.ok) {
        return NextResponse.json(
          { success: false, error: att.error },
          { status: att.status }
        );
      }
      return NextResponse.json({
        success: true,
        url: att.url,
        path: att.url,
        backendRegistered: true,
      });
    }

    /* Obraz dla dealroom: znak wodny, bez zmiany rekordu oferty — tylko uczestnik deala */
    if (purpose === 'dealroomAttachment') {
      const wm = await saveDealroomParticipantWatermarkedImage({
        offerId: offerIdNum,
        participantUserId: userId,
        fileBuffer: buffer,
        mimeTypeDeclared: declaredForImagePipeline,
        originalFileName: String((file as Blob & { name?: string }).name || ''),
        byteLengthInput: buffer.length,
      });
      if (!wm.ok) {
        return NextResponse.json(
          { success: false, error: wm.error },
          { status: wm.status }
        );
      }
      return NextResponse.json({
        success: true,
        url: wm.url,
        path: wm.url,
        backendRegistered: true,
      });
    }

    await acquireOfferUploadLock(offerIdNum);
    try {
      const img = await saveOfferGalleryOrFloorplan({
        offerId: offerIdNum,
        ownerUserId: userId,
        fileBuffer: buffer,
        mimeTypeDeclared: declaredForImagePipeline,
        originalFileName: String((file as Blob & { name?: string }).name || ''),
        isFloorPlan,
        byteLengthInput: buffer.length,
      });

      if (!img.ok) {
        return NextResponse.json(
          { success: false, error: img.error },
          { status: img.status }
        );
      }

      return NextResponse.json({
        success: true,
        url: img.url,
        path: img.url,
        backendRegistered: true,
      });
    } finally {
      releaseOfferUploadLock(offerIdNum);
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Błąd serwera';
    console.error('BŁĄD UPLOADU MOBILE:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

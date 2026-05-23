import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notificationService } from '@/lib/services/notification.service';
import { verifyMobileToken } from '@/lib/jwtMobile';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { getWebFormData } from '@/lib/requestFormData';
import {
  MAX_OFFER_FILE_BYTES,
  saveDealAttachmentForDealRoom,
} from '@/lib/upload/offerMediaUpload';
import { getDealReviewVisibility, resolveFinalizedAtSafe } from '@/lib/dealroomReviews';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const MESSAGE_DEDUP_WINDOW_MS = 10_000;

const globalAny = global as any;
if (typeof globalAny.typingStore === 'undefined') {
  globalAny.typingStore = {};
}

function parseUserIdFromAuthHeader(authHeader: string | null): number | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const rawToken = authHeader.slice('Bearer '.length).trim();
  const token = rawToken.startsWith('Bearer ') ? rawToken.slice('Bearer '.length).trim() : rawToken;
  if (!token) return null;

  const verified = verifyMobileToken(token) as any;
  const verifiedId = Number(verified?.id ?? verified?.userId ?? verified?.sub);
  if (Number.isFinite(verifiedId) && verifiedId > 0) {
    return verifiedId;
  }

  // Fallback dla starszych / niestandardowych tokenów w aplikacji.
  const decoded = jwt.decode(token) as any;
  const decodedId = Number(decoded?.id ?? decoded?.userId ?? decoded?.sub);
  if (Number.isFinite(decodedId) && decodedId > 0) {
    return decodedId;
  }

  return null;
}

export async function GET(req: Request) {
  try {
    const match = req.url.match(/\/deals\/(\d+)\/messages/);
    if (!match) return NextResponse.json({ error: 'Bad URL' }, { status: 400 });
    const dealIdInt = parseInt(match[1], 10);

    const userId = parseUserIdFromAuthHeader(req.headers.get('authorization'));
    if (!userId) return NextResponse.json({ error: 'Bad token' }, { status: 401 });

    const deal = await prisma.deal.findUnique({
      where: { id: dealIdInt },
      select: { id: true, buyerId: true, sellerId: true, finalizedAt: true, updatedAt: true }
    });
    if (!deal) return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    if (deal.buyerId !== userId && deal.sellerId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.dealMessage.updateMany({
      where: { dealId: dealIdInt, senderId: { not: userId }, isRead: false },
      data: { isRead: true }
    });

    const messages = await prisma.dealMessage.findMany({
      where: { dealId: dealIdInt },
      orderBy: { createdAt: 'asc' },
    });

    let isPartnerTyping = false;
    if (globalAny.typingStore[dealIdInt]) {
      for (const [tUserId, timestamp] of Object.entries(globalAny.typingStore[dealIdInt])) {
        if (Number(tUserId) !== userId && (Date.now() - (timestamp as number) < 4000)) {
          isPartnerTyping = true;
          break;
        }
      }
    }

    const reviewGate = await getDealReviewVisibility({
      dealId: dealIdInt,
      viewerId: userId,
      sides: { buyerId: deal.buyerId, sellerId: deal.sellerId },
      finalizedAt: resolveFinalizedAtSafe(deal),
    });

    return NextResponse.json({
      messages,
      isTyping: isPartnerTyping,
      ...(reviewGate || {
        myReviewSubmitted: false,
        reviewRevealAt: new Date(0).toISOString(),
        reviewRevealUnlocked: false,
        partnerReviewVisible: false,
        partnerReview: null,
      }),
    });
  } catch (error: any) {
    console.error('[CHAT GET ERROR]', error);
    return NextResponse.json({ messages: [], error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const match = req.url.match(/\/deals\/(\d+)\/messages/);
    if (!match) {
      return NextResponse.json({ success: false, error: 'Nieprawidłowy adres żądania.' }, { status: 400 });
    }
    const dealIdInt = parseInt(match[1], 10);

    const userId = parseUserIdFromAuthHeader(req.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Brak autoryzacji (Bearer token).' }, { status: 401 });
    }

    const deal = await prisma.deal.findUnique({
      where: { id: dealIdInt },
      select: { id: true, offerId: true, buyerId: true, sellerId: true },
    });
    if (!deal) {
      return NextResponse.json({ success: false, error: 'Deal nie został znaleziony.' }, { status: 404 });
    }
    if (deal.buyerId !== userId && deal.sellerId !== userId) {
      return NextResponse.json({ success: false, error: 'Brak dostępu do tej transakcji.' }, { status: 403 });
    }

    const ct = (req.headers.get('content-type') || '').toLowerCase();
    let content = '';
    let attachment: string | null = null;

    if (ct.includes('multipart/form-data')) {
      const formData = await getWebFormData(req);
      const rawFile = formData.get('file') ?? formData.get('attachment') ?? formData.get('document');
      content = String(formData.get('content') ?? formData.get('message') ?? formData.get('text') ?? '').trim();

      let uploadedName = '';
      if (
        rawFile &&
        typeof rawFile === 'object' &&
        typeof (rawFile as Blob).arrayBuffer === 'function'
      ) {
        const file = rawFile as File;
        uploadedName = String((file as Blob & { name?: string }).name || '').trim();
        let buffer: Buffer;
        try {
          buffer = Buffer.from(await file.arrayBuffer());
        } catch (e: unknown) {
          const m = e instanceof Error ? e.message : String(e);
          return NextResponse.json(
            { success: false, error: `Nie udało się odczytać pliku w wiadomości: ${m}` },
            { status: 400 }
          );
        }
        const blobSizeKnown = typeof file.size === 'number';
        if (
          (blobSizeKnown && file.size > MAX_OFFER_FILE_BYTES) ||
          buffer.length > MAX_OFFER_FILE_BYTES
        ) {
          return NextResponse.json(
            {
              success: false,
              error: `Plik jest za duży (max ${Math.round(MAX_OFFER_FILE_BYTES / (1024 * 1024))} MB).`,
            },
            { status: 413 }
          );
        }
        if (buffer.length > 0) {
          const saved = await saveDealAttachmentForDealRoom({
            dealId: dealIdInt,
            participantUserId: userId,
            fileBuffer: buffer,
            mimeTypeDeclared: String((file as Blob & { type?: string }).type || ''),
            originalFileName: uploadedName,
          });
          if (!saved.ok) {
            return NextResponse.json({ success: false, error: saved.error }, { status: saved.status });
          }
          attachment = saved.url;
        }
      }

      if (!content && !attachment) {
        return NextResponse.json(
          { success: false, error: 'Wyślij treść wiadomości lub załącz plik (file / attachment / document).' },
          { status: 400 }
        );
      }
      if (!content && attachment) {
        content = uploadedName ? `📎 ${uploadedName}` : '📎 Załącznik';
      }
    } else {
      let body: Record<string, unknown>;
      try {
        body = (await req.json()) as Record<string, unknown>;
      } catch {
        return NextResponse.json(
          {
            success: false,
            error:
              'Niepoprawny JSON. Do wysłania pliku użyj multipart/form-data z polem file, attachment lub document.',
          },
          { status: 400 }
        );
      }

      content = String(body?.content ?? '').trim();
      const rawAtt = body?.attachment ?? body?.url ?? body?.path ?? null;
      attachment =
        rawAtt != null && String(rawAtt).trim() !== '' ? String(rawAtt).trim() : null;

      if (!content && !attachment) {
        return NextResponse.json(
          { success: false, error: 'Brak treści (content) ani odnośnika do pliku (attachment / url / path).' },
          { status: 400 }
        );
      }
      if (!content && attachment) {
        content = '📎 Załącznik';
      }
    }

    // Anty-duplikat dla retry klienta/sieci: jeśli identyczna wiadomość była wysłana przed chwilą, nie twórz nowej.
    const dedupSince = new Date(Date.now() - MESSAGE_DEDUP_WINDOW_MS);
    const recentSame = await prisma.dealMessage.findFirst({
      where: {
        dealId: dealIdInt,
        senderId: userId,
        content,
        attachment: attachment || null,
        createdAt: { gte: dedupSince },
      },
      orderBy: { createdAt: 'desc' },
    });

    const newMessage =
      recentSame ||
      (await prisma.dealMessage.create({
        data: {
          dealId: dealIdInt,
          senderId: userId,
          content,
          attachment: attachment || undefined,
          isRead: false,
        },
      }));

    await prisma.deal.update({ where: { id: dealIdInt }, data: { updatedAt: new Date() } });

    const receiverId = deal.buyerId === userId ? deal.sellerId : deal.buyerId;
    const shortPreview = content.slice(0, 120) || 'Nowa wiadomość';

    let shouldSendPush = true;
    try {
      await prisma.notification.create({
        data: {
          userId: receiverId,
          idempotencyKey: `deal_msg:deal:${dealIdInt}:msg:${newMessage.id}`,
          title: 'Nowa wiadomość w Dealroom',
          body: shortPreview,
          type: 'DEAL_UPDATE',
          targetType: 'DEAL',
          targetId: String(dealIdInt),
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        shouldSendPush = false;
      } else {
        throw error;
      }
    }

    if (shouldSendPush) {
      try {
        await notificationService.sendPushToUser(receiverId, {
          title: 'Nowa wiadomość w Dealroom',
          body: shortPreview,
          data: {
            target: 'dealroom',
            notificationType: 'dealroom_chat',
            targetType: 'DEAL',
            targetId: String(dealIdInt),
            dealId: dealIdInt,
            offerId: deal.offerId,
            deeplink: `estateos://dealroom/${dealIdInt}`,
            screen: 'DealroomChat',
            route: 'DealroomChat',
            kind: 'deal_message',
          },
        });
      } catch (pushError) {
        console.warn('[CHAT PUSH WARN]', pushError);
      }
    }

    if (globalAny.typingStore[dealIdInt]) {
      delete globalAny.typingStore[dealIdInt][userId];
    }

    return NextResponse.json({
      success: true,
      message: newMessage,
      ...(attachment ? { url: attachment, path: attachment } : {}),
    });
  } catch (error: unknown) {
    console.error('[CHAT POST ERROR]', error);
    const msg = error instanceof Error ? error.message : 'Błąd serwera.';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

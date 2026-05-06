import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { decryptSession } from '@/lib/sessionUtils';
import { notificationService } from '@/lib/services/notification.service';
import { getWebFormData } from '@/lib/requestFormData';
import {
  MAX_OFFER_FILE_BYTES,
  saveDealAttachmentForDealRoom,
} from '@/lib/upload/offerMediaUpload';

const globalAny = globalThis as typeof globalThis & { sseClients?: Set<{ send: (payload: unknown) => void }> };

async function resolveUserId(req: Request): Promise<number | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('estateos_session')?.value || cookieStore.get('luxestate_user')?.value;
  const dealToken = cookieStore.get('deal_token')?.value;
  const authHeader = req.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : null;

  // 1) Priorytet: aktywna sesja web (najbardziej wiarygodna dla aktualnie zalogowanego usera).
  if (sessionToken) {
    const session = decryptSession(sessionToken);
    if (session?.id) {
      const userId = Number(session.id);
      if (Number.isFinite(userId) && userId > 0) return userId;
    }
    if (session?.email) {
      const user = await prisma.user.findFirst({ where: { email: String(session.email) }, select: { id: true } });
      if (user?.id) return user.id;
    }
  }

  // 2) Następnie bearer token (np. mobile/web hybrid flow).
  const secretRaw = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || '';
  const tokensToTry = [bearerToken, dealToken].filter(Boolean) as string[];
  for (const token of tokensToTry) {
    if (!secretRaw) continue;
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(secretRaw));
      const userId = Number(payload.id || payload.sub);
      if (Number.isFinite(userId) && userId > 0) return userId;
    } catch {
      // try next token
    }
  }

  return null;
}

// POBIERANIE WIADOMOŚCI (GET)
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const dealId = parseInt(id);
    if (isNaN(dealId)) {
        return NextResponse.json({ success: false, error: 'Nieprawidłowe ID transakcji' }, { status: 400 });
    }

    const messages = await prisma.dealMessage.findMany({
      where: { dealId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ success: true, messages });
  } catch (error: any) {
    console.error('Błąd pobierania wiadomości:', error.message);
    return NextResponse.json({ success: false, error: 'Błąd serwera' }, { status: 500 });
  }
}

// WYSYŁANIE WIADOMOŚCI (POST) — JSON lub multipart/form-data (file | attachment | document)
export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const dealId = parseInt(id);
    if (isNaN(dealId)) {
      return NextResponse.json({ success: false, error: 'Nieprawidłowe ID transakcji' }, { status: 400 });
    }

    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { id: true, buyerId: true, sellerId: true },
    });
    if (!deal) {
      return NextResponse.json({ success: false, error: 'Transakcja nie istnieje' }, { status: 404 });
    }

    let senderId = await resolveUserId(req);
    let senderIdFromBody: number | null = null;

    const ct = (req.headers.get('content-type') || '').toLowerCase();
    let content = '';
    let attachment: string | null = null;

    if (ct.includes('multipart/form-data')) {
      const formData = await getWebFormData(req);
      const sidRaw = formData.get('senderId');
      if (sidRaw != null && String(sidRaw).trim() !== '') {
        senderIdFromBody = Number(String(sidRaw));
      }

      if (!senderId && Number.isFinite(senderIdFromBody) && senderIdFromBody && senderIdFromBody > 0) {
        if (senderIdFromBody === deal.buyerId || senderIdFromBody === deal.sellerId) {
          senderId = senderIdFromBody;
        }
      }
      if (!senderId) {
        return NextResponse.json({ success: false, error: 'Brak autoryzacji' }, { status: 401 });
      }
      if (senderId !== deal.buyerId && senderId !== deal.sellerId) {
        return NextResponse.json({ success: false, error: 'Brak dostępu do tej transakcji' }, { status: 403 });
      }

      content = String(formData.get('content') ?? formData.get('message') ?? formData.get('text') ?? '').trim();
      const rawFile = formData.get('file') ?? formData.get('attachment') ?? formData.get('document');

      let uploadedName = '';
      if (rawFile && typeof rawFile === 'object' && 'arrayBuffer' in rawFile) {
        const file = rawFile as File;
        uploadedName = String((file as Blob & { name?: string }).name || '').trim();
        if (typeof file.size === 'number' && file.size > 0) {
          if (file.size > MAX_OFFER_FILE_BYTES) {
            return NextResponse.json(
              {
                success: false,
                error: `Plik jest za duży (max ${Math.round(MAX_OFFER_FILE_BYTES / (1024 * 1024))} MB).`,
              },
              { status: 413 }
            );
          }
          const buffer = Buffer.from(await file.arrayBuffer());
          const saved = await saveDealAttachmentForDealRoom({
            dealId,
            participantUserId: senderId,
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
          { success: false, error: 'Brak treści wiadomości lub pliku.' },
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
              'Niepoprawny JSON lub użyj multipart/form-data dla pliku (pola file, attachment lub document).',
          },
          { status: 400 }
        );
      }

      senderIdFromBody = body?.senderId ? Number(body.senderId) : null;
      if (!senderId && senderIdFromBody && (senderIdFromBody === deal.buyerId || senderIdFromBody === deal.sellerId)) {
        senderId = senderIdFromBody;
      }
      if (!senderId) {
        return NextResponse.json({ success: false, error: 'Brak autoryzacji' }, { status: 401 });
      }
      if (senderId !== deal.buyerId && senderId !== deal.sellerId) {
        return NextResponse.json({ success: false, error: 'Brak dostępu do tej transakcji' }, { status: 403 });
      }

      content = String(body?.content ?? '').trim();
      const rawAtt = body?.attachment ?? body?.url ?? body?.path ?? null;
      attachment =
        rawAtt != null && String(rawAtt).trim() !== '' ? String(rawAtt).trim() : null;

      if (!content && !attachment) {
        return NextResponse.json({ success: false, error: 'Brak treści wiadomości lub załącznika.' }, { status: 400 });
      }
      if (!content && attachment) {
        content = '📎 Załącznik';
      }
    }

    const newMessage = await prisma.dealMessage.create({
      data: {
        dealId,
        senderId,
        content,
        attachment: attachment || undefined,
      },
    });

    await prisma.deal.update({
      where: { id: dealId },
      data: { updatedAt: new Date() },
    });

    const receiverId = deal.buyerId === senderId ? deal.sellerId : deal.buyerId;
    const senderUser = await prisma.user.findUnique({ where: { id: senderId }, select: { name: true } });
    const shortPreview = content.slice(0, 120) || 'Nowa wiadomość';

    await prisma.notification.create({
      data: {
        userId: receiverId,
        title: 'Nowa wiadomość w Dealroom',
        body: shortPreview,
        type: 'DEAL_UPDATE',
        targetType: 'DEAL',
        targetId: String(dealId),
      },
    });

    try {
      await notificationService.sendPushToUser(receiverId, {
        title: 'Nowa wiadomość w Dealroom',
        body: shortPreview,
        data: {
          targetType: 'DEAL',
          targetId: String(dealId),
          dealId: String(dealId),
          kind: 'deal_message',
          senderId: String(senderId),
          senderName: senderUser?.name || 'Użytkownik',
        },
      });
    } catch (pushError) {
      console.warn('[DEAL MESSAGE PUSH WARN]', pushError);
    }

    if (globalAny.sseClients) {
      globalAny.sseClients.forEach((c) =>
        c.send({ type: 'NEW_MESSAGE', payload: { dealId, messageId: newMessage.id } })
      );
    }

    return NextResponse.json({
      success: true,
      message: newMessage,
      ...(attachment ? { url: attachment, path: attachment } : {}),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Błąd serwera';
    console.error('Błąd wysyłania wiadomości:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

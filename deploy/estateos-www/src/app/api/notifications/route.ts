import { encryptSession, decryptSession } from '@/lib/sessionUtils';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('luxestate_user') || cookieStore.get('estateos_session');
    if (!sessionCookie) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });

    let sessionData: any = {};
    try { sessionData = decryptSession(sessionCookie.value); } catch(e) {}

    let userIdStr = sessionCookie.value;
    if (sessionData && sessionData.id) {
      userIdStr = sessionData.id;
    }

    const userIdNum = Number(userIdStr);
    
    // Zabezpieczenie przed wywaleniem bazy przez NaN
    if (isNaN(userIdNum)) {
       return NextResponse.json([]); 
    }

    const notifications = await prisma.notification.findMany({
      where: { userId: userIdNum },
      orderBy: { createdAt: 'desc' },
      take: 60
    });

    const parseRadarBody = (body: string) => {
      const raw = String(body || '').trim();
      if (!raw) return { title: '', price: null as number | null };
      const [titlePart, pricePart] = raw.split('•').map((s) => String(s || '').trim());
      const numericPrice = Number(String(pricePart || '').replace(/[^\d]/g, ''));
      return {
        title: titlePart,
        price: Number.isFinite(numericPrice) && numericPrice > 0 ? numericPrice : null,
      };
    };

    const dealIds = Array.from(
      new Set(
        notifications
          .filter((n) => n.targetType === 'DEAL' && n.targetId)
          .map((n) => Number(n.targetId))
          .filter((v) => Number.isFinite(v) && v > 0)
      )
    );
    const offerIdsDirect = Array.from(
      new Set(
        notifications
          .filter((n) => n.targetType === 'OFFER' && n.targetId)
          .map((n) => Number(n.targetId))
          .filter((v) => Number.isFinite(v) && v > 0)
      )
    );

    const deals = dealIds.length
      ? await prisma.deal.findMany({
          where: { id: { in: dealIds } },
          select: {
            id: true,
            buyerId: true,
            sellerId: true,
            buyer: { select: { id: true, name: true } },
            seller: { select: { id: true, name: true } },
            offer: { select: { id: true, title: true } },
          },
        })
      : [];

    const offerIdsFromDeals = Array.from(
      new Set(deals.map((d) => Number(d.offer?.id || 0)).filter((v) => Number.isFinite(v) && v > 0))
    );
    const offerIds = Array.from(new Set([...offerIdsDirect, ...offerIdsFromDeals]));
    const offers = offerIds.length
      ? await prisma.offer.findMany({
          where: { id: { in: offerIds } },
          select: { id: true, title: true },
        })
      : [];

    const dealsById = new Map(deals.map((d) => [d.id, d]));
    const offersById = new Map(offers.map((o) => [o.id, o]));

    const compactTitle = (title?: string | null) => {
      const txt = String(title || '').replace(/\s+/g, ' ').trim();
      if (!txt) return 'oferta';
      return txt.length > 48 ? `${txt.slice(0, 47)}...` : txt;
    };

    const radarHints = notifications
      .filter((n) => n.type === 'AI_RADAR' && !n.targetType && !n.targetId)
      .map((n) => parseRadarBody(n.body))
      .filter((h) => h.title);
    const radarCandidates = radarHints.length
      ? await prisma.offer.findMany({
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 400,
          select: { id: true, title: true, price: true },
        })
      : [];

    const formatted = notifications.map((n) => {
      const dealId = n.targetType === 'DEAL' ? Number(n.targetId) : null;
      let offerId = n.targetType === 'OFFER'
        ? Number(n.targetId)
        : (dealId ? Number(dealsById.get(dealId)?.offer?.id || 0) : 0);
      const radarBody = parseRadarBody(n.body);
      if (!offerId && n.type === 'AI_RADAR' && radarBody.title) {
        const normalizedHint = radarBody.title.toLowerCase();
        const match = radarCandidates.find((o) => {
          const titleOk = String(o.title || '').toLowerCase() === normalizedHint;
          if (!titleOk) return false;
          if (!radarBody.price) return true;
          return Math.round(Number(o.price || 0)) === Math.round(radarBody.price);
        }) || radarCandidates.find((o) => String(o.title || '').toLowerCase() === normalizedHint);
        offerId = match?.id || 0;
      }
      const deal = dealId ? dealsById.get(dealId) : null;
      const offer = offerId ? offersById.get(offerId) : null;
      const otherParty =
        deal
          ? (deal.buyerId === userIdNum ? deal.seller?.name : deal.buyer?.name) || 'użytkownika'
          : 'użytkownika';
      const shortOfferTitle = compactTitle(offer?.title);
      const baseBody = String(n.body || '').trim();

      let title = n.title;
      let message = baseBody;
      let link: string | null = null;
      let groupKey = `notification:${n.id}`;

      if (n.targetType === 'DEAL' && dealId) {
        link = `/moje-konto/crm?tab=transakcje&dealId=${dealId}`;
      } else if (n.targetType === 'OFFER' && offerId) {
        link = `/oferta/${offerId}`;
      } else if (n.type === 'AI_RADAR' && offerId) {
        link = `/oferta/${offerId}`;
      }

      if (n.type === 'DEAL_UPDATE' && dealId) {
        title = `Nowa wiadomość od ${otherParty}`;
        message = `Transakcja: ${shortOfferTitle}. ${baseBody || 'Masz nową aktywność na czacie.'}`;
        groupKey = `deal-activity:${dealId}`;
      } else if (n.type === 'BID_RECEIVED' && dealId) {
        title = `${n.title}`;
        message = `Oferta: ${shortOfferTitle}. ${baseBody}`;
        groupKey = `deal-activity:${dealId}`;
      } else if (n.type === 'APPOINTMENT' && dealId) {
        message = `Oferta: ${shortOfferTitle}. ${baseBody}`;
        groupKey = `deal-activity:${dealId}`;
      } else if (offerId) {
        message = `Oferta: ${shortOfferTitle}. ${baseBody}`;
      }

      return {
        id: n.id,
        title,
        message,
        type: n.type,
        createdAt: n.createdAt,
        readAt: n.readAt,
        isRead: Boolean(n.readAt || n.status === 'READ'),
        link,
        groupKey,
      };
    });

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("[NOTIFICATIONS GET ERROR]", error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('luxestate_user') || cookieStore.get('estateos_session');
    if (!sessionCookie) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });

    let sessionData: any = {};
    try { sessionData = decryptSession(sessionCookie.value); } catch(e) {}

    let userIdStr = sessionCookie.value;
    if (sessionData && sessionData.id) userIdStr = sessionData.id;

    const userIdNum = Number(userIdStr);
    if (isNaN(userIdNum)) return NextResponse.json({ success: false });

    await prisma.notification.updateMany({
      where: { userId: userIdNum, readAt: null },
      data: { readAt: new Date(), status: 'READ' }
    });

    return NextResponse.json({ success: true });
  } catch(e) {
    return NextResponse.json({ error: 'Błąd aktualizacji' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { id } = await req.json().catch(() => ({}));
    if (!id) return NextResponse.json({ error: 'Brak ID' }, { status: 400 });
    
    await prisma.notification.update({
      where: { id },
      data: { readAt: new Date(), status: 'READ' }
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Błąd' }, { status: 500 });
  }
}

import { decryptSession } from '@/lib/sessionUtils';
import { NextResponse } from 'next/server';
import type { OfferStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS OfferViewLog (
        id BIGINT NOT NULL AUTO_INCREMENT,
        offerId INT NOT NULL,
        visitorKey VARCHAR(128) NOT NULL,
        source VARCHAR(16) NOT NULL DEFAULT 'web',
        ip VARCHAR(64) NULL,
        userAgent VARCHAR(255) NULL,
        hits INT NOT NULL DEFAULT 1,
        createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        lastSeenAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY OfferViewLog_offerId_visitorKey_key (offerId, visitorKey),
        KEY OfferViewLog_offerId_lastSeenAt_idx (offerId, lastSeenAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const offer = await prisma.offer.findUnique({ 
      where: { id: Number(resolvedParams.id) },
      include: { user: true }
    });
    
    if (!offer) return NextResponse.json({ error: "Nie znaleziono oferty" }, { status: 404 });

    let isRealPro = false;
    let loggedInEmail = null;
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('estateos_session');

    if (sessionCookie) {
      const sessionData = decryptSession(sessionCookie.value);
      loggedInEmail = sessionData?.email || null;
    }

    if (loggedInEmail) {
      const realUser = await prisma.user.findUnique({ where: { email: loggedInEmail } });
      if (realUser) {
        const proExpiresAt = realUser.proExpiresAt ? new Date(realUser.proExpiresAt) : null;
        isRealPro = Boolean(
          realUser.role === 'ADMIN' ||
          (realUser.isPro && (!proExpiresAt || proExpiresAt.getTime() > Date.now()))
        );
      }
    }

    const viewsRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COUNT(*) as total FROM OfferViewLog WHERE offerId = ?`,
      Number(resolvedParams.id)
    );
    const viewsCount = Number(viewsRows?.[0]?.total || 0);

    return NextResponse.json({ ...offer, _viewerIsPro: isRealPro, views: viewsCount, viewsCount });

  } catch (error) {
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const body = await req.json();
    
    // Pobieramy aktualny stan oferty z bazy przed dokonaniem zmian
    const currentOffer = await prisma.offer.findUnique({
       where: { id: Number(resolvedParams.id) }
    });

    if (!currentOffer) {
       return NextResponse.json({ error: "Oferta nie istnieje" }, { status: 404 });
    }

    let requireReverification = false;
    
    const sensitiveFields = [
      'title', 'description', 'district', 'area', 'images', 'propertyType',
      'rooms', 'floor', 'yearBuilt', 'plotArea', 'floorPlanUrl', 'street', 'buildingNumber',
      'lat', 'lng', 'transactionType'
    ];

    for (const field of sensitiveFields) {
       const currentVal = String(currentOffer[field as keyof typeof currentOffer] ?? '').trim();
       const newVal = String(body[field] ?? '').trim();
       
       if (currentVal !== newVal) {
           requireReverification = true;
           console.log(`Zmieniono pole: ${field}. Wymagana ponowna weryfikacja.`);
           break;
       }
    }

    let newStatus: OfferStatus = currentOffer.status;
    if (requireReverification && currentOffer.status === 'ACTIVE') {
        newStatus = 'PENDING';
    }

    const parsedPrice = parseFloat(String(body.price ?? currentOffer.price).replace(',', '.'));
    const parsedArea = parseFloat(String(body.area ?? currentOffer.area).replace(',', '.'));
    const parsedRooms =
      body.rooms !== undefined && String(body.rooms).trim() !== ''
        ? parseInt(String(body.rooms), 10)
        : currentOffer.rooms;
    const parsedFloor =
      body.floor !== undefined && String(body.floor).trim() !== ''
        ? parseInt(String(body.floor), 10)
        : currentOffer.floor;
    const parsedPlot =
      body.plotArea !== undefined && String(body.plotArea).trim() !== ''
        ? parseFloat(String(body.plotArea).replace(',', '.'))
        : currentOffer.plotArea;
    const parsedYear =
      body.year !== undefined || body.buildYear !== undefined
        ? (() => {
            const raw = body.year ?? body.buildYear;
            const n = parseInt(String(raw), 10);
            return Number.isFinite(n) ? n : currentOffer.yearBuilt;
          })()
        : currentOffer.yearBuilt;

    const updatedOffer = await prisma.offer.update({
      where: { id: Number(resolvedParams.id) },
      data: {
        title: body.title != null ? String(body.title) : currentOffer.title,
        description: body.description != null ? String(body.description) : currentOffer.description,
        propertyType: body.propertyType ?? currentOffer.propertyType,
        district: body.district != null ? String(body.district) : currentOffer.district,
        price: Number.isFinite(parsedPrice) ? parsedPrice : currentOffer.price,
        area: Number.isFinite(parsedArea) ? parsedArea : currentOffer.area,
        images:
          body.images != null
            ? typeof body.images === 'string'
              ? body.images
              : JSON.stringify(body.images)
            : currentOffer.images,
        rooms: parsedRooms ?? null,
        floor: parsedFloor ?? null,
        yearBuilt: parsedYear ?? null,
        plotArea: parsedPlot ?? null,
        floorPlanUrl:
          body.floorPlanUrl != null
            ? String(body.floorPlanUrl)
            : body.floorPlan != null
              ? String(body.floorPlan)
              : currentOffer.floorPlanUrl,
        status: newStatus,
      }
    });
    
    return NextResponse.json({ success: true, offer: updatedOffer, statusChanged: requireReverification });
  } catch (error) {
    return NextResponse.json({ error: "Błąd serwera przy zapisie" }, { status: 500 });
  }
}

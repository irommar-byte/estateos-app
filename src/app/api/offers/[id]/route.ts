import { encryptSession, decryptSession } from '@/lib/sessionUtils';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
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
      try { loggedInEmail = decryptSession(sessionCookie.value).email; } 
      catch (e) { loggedInEmail = sessionCookie.value; }
    }

    if (loggedInEmail) {
      const realUser = await prisma.user.findUnique({ where: { email: loggedInEmail } });
      if (realUser) {
        isRealPro = realUser.isPro || realUser.role === 'ADMIN';
      }
    }

    return NextResponse.json({ ...offer, _viewerIsPro: isRealPro });

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

    // 1. Definiujemy, które pola traktujemy jako "bezpieczne" do zmiany bez utraty weryfikacji
    const newPrice = String(body.price || '0');
    
    // 2. Sprawdzamy czy COKOLWIEK poza ceną uległo zmianie.
    // Ignorujemy pola takie jak 'updatedAt', 'views' itp.
    let requireReverification = false;
    
    const sensitiveFields = [
      'title', 'propertyType', 'district', 'area', 'description', 'address',
      'imageUrl', 'images', 'contactName', 'lat', 'lng', 'advertiserType',
      'agencyName', 'rooms', 'floor', 'heating', 'year', 'plotArea', 'floorPlan', 'amenities'
    ];

    for (const field of sensitiveFields) {
       // Konwertujemy wszystko na stringi dla bezpiecznego porównania
       const currentVal = String(currentOffer[field as keyof typeof currentOffer] || '').trim();
       const newVal = String(body[field] || '').trim();
       
       if (currentVal !== newVal) {
           requireReverification = true;
           console.log(`Zmieniono pole: ${field}. Wymagana ponowna weryfikacja.`);
           break;
       }
    }

    // 3. Określamy nowy status
    let newStatus = currentOffer.status;
    if (requireReverification && currentOffer.status === 'ACTIVE') {
        newStatus = 'pending_approval'; // Cofa do weryfikacji!
    }

    // 4. Aktualizujemy w bazie (NIE pozwalamy z zewnątrz nadpisać telefonu i adresu)
    const updatedOffer = await prisma.offer.update({
      where: { id: Number(resolvedParams.id) },
      data: {
        title: body.title,
        propertyType: body.propertyType,
        district: body.district,
        price: newPrice,
        area: String(body.area || '0'),
        description: body.description,
        // Celowo OMIJAMY zapisywanie address, lat, lng, contactPhone (zablokowane na froncie)
        imageUrl: body.imageUrl,
        images: body.images,
        contactName: body.contactName,
        agencyName: body.agencyName,
        rooms: String(body.rooms || ''),
        floor: String(body.floor || ''),
        heating: body.heating,
        year: String(body.year || body.buildYear || ''),
        plotArea: String(body.plotArea || ''),
        floorPlan: body.floorPlan,
        amenities: body.amenities,
        status: newStatus // Zapisujemy nowy (lub stary) status
      }
    });
    
    return NextResponse.json({ success: true, offer: updatedOffer, statusChanged: requireReverification });
  } catch (error) {
    return NextResponse.json({ error: "Błąd serwera przy zapisie" }, { status: 500 });
  }
}

import { encryptSession, decryptSession } from '@/lib/sessionUtils';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('estateos_session');

    if (!sessionCookie) {
      return NextResponse.json({ error: "Niezalogowany" }, { status: 401 });
    }

    // BEZPIECZNE ROZPAKOWANIE SESJI (obsługuje nowy i stary format zapisu)
    let emailToSearch = sessionCookie.value;
    try {
       const parsedSession = decryptSession(sessionCookie.value);
       if (parsedSession && parsedSession.email) {
           emailToSearch = parsedSession.email;
       }
    } catch(e) {}

    const user = await prisma.user.findUnique({
      where: { email: emailToSearch },
      include: { offers: true }
    });

    if (!user) {
      return NextResponse.json({ error: "Użytkownik nie istnieje" }, { status: 401 });
    }

    let matchedOffers: any[] = [];
    
    if (user.searchType) {
      const allActiveOffers = await prisma.offer.findMany({
        where: { 
          status: 'ACTIVE',
          NOT: { userId: user.id }
        }
      });

      const normalize = (s: any) => String(s || '').toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ').trim();

      matchedOffers = allActiveOffers.filter(offer => {
        // 1. Typ nieruchomości
        if (user.searchType && normalize(user.searchType) !== normalize(offer.propertyType)) return false;
        
        // 2. Budżet
        const offerPrice = parseInt(String(offer.price).replace(/\D/g, '')) || 0;
        if (user.searchMaxPrice && offerPrice > user.searchMaxPrice) return false;
        
        // 3. Metraż
        const offerArea = parseFloat(String(offer.area).replace(',', '.')) || 0;
        if (user.searchAreaFrom && offerArea < user.searchAreaFrom) return false;
        
        // 4. Pokoje
        const offerRooms = parseInt(String(offer.rooms)) || 0;
        if (user.searchRooms && offerRooms < user.searchRooms) return false;
        
        // 5. Dzielnice
        if (user.searchDistricts && user.searchDistricts.trim() !== '') {
          const normOfferDist = normalize(offer.district);
          const districts = user.searchDistricts.split(',').map(normalize);
          if (normOfferDist !== '' && !districts.includes(normOfferDist) && !districts.includes('cała warszawa') && !districts.includes('cala warszawa')) {
            return false;
          }
        }
        // 6. Absolutne Priorytety (Udogodnienia)
        if (user.searchAmenities && user.searchAmenities.trim() !== '') {
          const reqAmenities = user.searchAmenities.split(',').map(normalize);
          const offerAmenities = normalize(String(offer.amenities || ''));
          for (const req of reqAmenities) {
            if (req !== '' && !offerAmenities.includes(req)) {
              return false; // Oferta zostaje brutalnie odrzucona
            }
          }
        }
        return true;
      });
    }
    const proExpiresAt = user.proExpiresAt ? new Date(user.proExpiresAt) : null;
    const isProActive = Boolean(
      user.role === 'ADMIN' ||
      (user.isPro && (!proExpiresAt || proExpiresAt.getTime() > Date.now()))
    );

    return NextResponse.json({
      ...user,
      isPro: isProActive,
      matchedOffers
    });

  } catch (error) {
    console.error("Błąd API Profilu:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

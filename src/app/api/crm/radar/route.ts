import { encryptSession, decryptSession } from '@/lib/sessionUtils';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    
    const cookieStore = await cookies();
    const nextAuthSession = await getServerSession(authOptions);
    const sessionCookie = cookieStore.get('luxestate_user') || cookieStore.get('estateos_session');
    
    let email = null;
    if (nextAuthSession?.user?.email) {
        email = nextAuthSession.user.email;
    } else if (sessionCookie) {
        try { 
            let sessionData = decryptSession(sessionCookie.value); 
            email = sessionData.email || sessionCookie.value;
        } catch(e) {
            email = sessionCookie.value;
        }
    }

    if (!email) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });
    
    // Pobieramy użytkownika wraz z jego statusem PRO
    const user = await prisma.user.findUnique({ 
        where: { email: String(email) },
        select: { id: true, isPro: true, planType: true }
    });
    
    if (!user) return NextResponse.json({ error: 'Brak usera' }, { status: 401 });

    // 1. Pobierzemy wszystkie aktywne oferty tego użytkownika
    const myOffers = await prisma.offer.findMany({ 
        where: { userId: user.id, status: 'ACTIVE' } 
    });
    
    // 2. Pobierzemy bazę wszystkich Zarejestrowanych Kupców (którzy podali preferencje)
    const allBuyers = await prisma.user.findMany({
       where: { searchType: { not: null } }
    });

    // 3. Algorytm Swatania (Matchmaking) z Logiką 12-godzinnego Opóźnienia
    const radarResults = myOffers.map(offer => {
       const offerPrice = parseInt(offer.price.replace(/\D/g, '')) || 0;
       
       const matches = allBuyers.filter(buyer => {
          if (buyer.id === user.id) return false; // Nie sprzedajemy samemu sobie
          
          // Logika elastycznego dopasowania
          const typeMatch = !buyer.searchType || buyer.searchType === "Wszystkie" || buyer.searchType === "Dowolny" || buyer.searchType === offer.propertyType;
          const distMatch = !buyer.searchDistricts || buyer.searchDistricts.includes("Wszystkie") || buyer.searchDistricts.includes(offer.district);
          const priceMatch = !buyer.searchMaxPrice || buyer.searchMaxPrice >= offerPrice;
          const transactionMatch = !buyer.searchTransactionType || buyer.searchTransactionType === "all" || buyer.searchTransactionType === offer.transactionType;
          
          return typeMatch && distMatch && priceMatch && transactionMatch;
       });

       // 🔥 LOGIKA OPÓŹNIENIA 12H (RADAR FOMO) 🔥
       // Liczymy ile godzin upłynęło od dodania oferty
       const hoursSinceCreation = (Date.now() - new Date(offer.createdAt).getTime()) / (1000 * 60 * 60);
       
       // Użytkownik jest zablokowany, jeśli NIE ma PRO i nie minęło 12 godzin
       const isLocked = !user.isPro && hoursSinceCreation < 12;

       return {
         offer,
         matchCount: matches.length,
         // Jeśli zablokowane (Basic < 12h), ukrywamy ID kupców, żeby użytkownik nie mógł do nich dotrzeć przez API!
         matchedBuyerIds: isLocked ? [] : matches.map(m => m.id),
         isLocked: isLocked,
         unlocksInHours: isLocked ? Math.ceil(12 - hoursSinceCreation) : 0
       };
    });

    return NextResponse.json(radarResults);
  } catch(e) {
    console.error("Błąd radaru:", e);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}

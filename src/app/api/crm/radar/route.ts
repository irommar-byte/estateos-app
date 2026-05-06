import { encryptSession, decryptSession } from '@/lib/sessionUtils';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { OFFER_PREMARKET_EMBARGO_HOURS } from '@/lib/offerPremarket';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

export const dynamic = 'force-dynamic';

function toNumericPrice(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    return parseInt(value.replace(/\D/g, ''), 10) || 0;
  }
  return 0;
}

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

    // 3. Algorytm swatania: Basic nie widzi ID kupców do momentu „premiery na szerokim rynku” (embargo)
    const radarResults = myOffers.map(offer => {
       const offerPrice = toNumericPrice(offer.price);
       
       const matches = allBuyers.filter(buyer => {
          if (buyer.id === user.id) return false; // Nie sprzedajemy samemu sobie
          
          // Logika elastycznego dopasowania
          const typeMatch = !buyer.searchType || buyer.searchType === "Wszystkie" || buyer.searchType === "Dowolny" || buyer.searchType === offer.propertyType;
          const distMatch = !buyer.searchDistricts || buyer.searchDistricts.includes("Wszystkie") || buyer.searchDistricts.includes(offer.district);
          const priceMatch = !buyer.searchMaxPrice || buyer.searchMaxPrice >= offerPrice;
          const transactionMatch = !buyer.searchTransactionType || buyer.searchTransactionType === "all" || buyer.searchTransactionType === offer.transactionType;
          
          return typeMatch && distMatch && priceMatch && transactionMatch;
       });

       // Basic: przez pierwsze N godzin po dodaniu oferty sprzedający nie widzi listy dopasowanych kupców (PRO omija)
       const hoursSinceCreation =
         (Date.now() - new Date(offer.createdAt).getTime()) / (1000 * 60 * 60);
       const isLocked =
         !user.isPro &&
         hoursSinceCreation < OFFER_PREMARKET_EMBARGO_HOURS;

       return {
         offer,
         matchCount: matches.length,
         matchedBuyerIds: isLocked ? [] : matches.map(m => m.id),
         isLocked,
         unlocksInHours: isLocked
           ? Math.ceil(OFFER_PREMARKET_EMBARGO_HOURS - hoursSinceCreation)
           : 0,
       };
    });

    return NextResponse.json(radarResults);
  } catch(e) {
    console.error("Błąd radaru:", e);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}

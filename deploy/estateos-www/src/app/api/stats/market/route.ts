import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Pobieramy wszystkie AKTYWNE mieszkania
    const offers = await prisma.offer.findMany({
      where: { 
        propertyType: { in: ['FLAT'] },
        status: { in: ['ACTIVE'] },
        expiresAt: { gt: new Date() } // Gilotyna czasu (tylko ważne)
      },
      select: { price: true, area: true }
    });

    let totalPrice = 0;
    let totalArea = 0;

    offers.forEach(offer => {
       const p = parseFloat(String(offer.price).replace(/[^0-9.]/g, ''));
       const a = parseFloat(String(offer.area).replace(/,/g, '.').replace(/[^0-9.]/g, ''));
       
       // Zabezpieczenie przed błędnymi danymi
       if (!isNaN(p) && !isNaN(a) && p > 0 && a > 0) {
         totalPrice += p;
         totalArea += a;
       }
    });

    let avgPricePerSqm = 0;
    if (totalArea > 0) {
       avgPricePerSqm = Math.round(totalPrice / totalArea);
    } else {
       // Fallback (zabezpieczenie), jeśli baza jest chwilowo pusta
       avgPricePerSqm = 24500; 
    }

    return NextResponse.json({ avgPricePerSqm });
  } catch (error) {
    return NextResponse.json({ error: 'Błąd obliczeń', avgPricePerSqm: 24500 }, { status: 500 });
  }
}

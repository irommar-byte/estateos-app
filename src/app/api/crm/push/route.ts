import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Dłuższy czas na wysyłkę wielu SMSów

export async function POST(req: Request) {
  try {
    const { offerId } = await req.json();
    if (!offerId) return NextResponse.json({ error: 'Brak ID oferty' }, { status: 400 });

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('luxestate_user') || cookieStore.get('estateos_session');
    if (!sessionCookie) return NextResponse.json({ error: 'Brak sesji' }, { status: 401 });

    // 1. Pobieramy ofertę
    const offer = await prisma.offer.findUnique({ where: { id: Number(offerId) } });
    if (!offer) return NextResponse.json({ error: 'Nie znaleziono oferty' }, { status: 404 });

    // 2. Pobieramy wszystkich kupujących z radarem i numerem telefonu
    const radarUsers = await prisma.user.findMany({
      where: { searchType: { not: null }, phone: { not: null } },
      select: { id: true, phone: true, searchType: true, searchDistricts: true, searchMaxPrice: true, searchAreaFrom: true, searchAmenities: true }
    });

    const offerPrice = Number(String(offer.price || '0').replace(/\D/g, ''));
    const offerArea = Number(String(offer.area || '0').replace(/,/g, '.').replace(/[^0-9.]/g, ''));
    const offerAmenities = offer.amenities ? offer.amenities.split(',').map(a => a.trim()) : [];

    let sentCount = 0;

    // 3. Silnik dopasowań i wysyłka
    for (const radar of radarUsers) {
      if (radar.searchType && radar.searchType !== 'Wszystkie' && radar.searchType !== offer.propertyType) continue;
      if (radar.searchDistricts && radar.searchDistricts !== 'Wszystkie' && radar.searchDistricts.length > 0) {
         const reqDistricts = radar.searchDistricts.split(',');
         if (!reqDistricts.includes(offer.district)) continue;
      }
      if (radar.searchMaxPrice && offerPrice > radar.searchMaxPrice) continue;
      if (radar.searchAreaFrom && offerArea < radar.searchAreaFrom) continue;
      if (radar.searchAmenities && radar.searchAmenities.length > 0) {
         const reqAmenities = radar.searchAmenities.split(',').map(a => a.trim());
         const hasAll = reqAmenities.every(a => offerAmenities.includes(a));
         if (!hasAll) continue;
      }

      // MATCH! Wysyłamy SMS
      if (radar.phone) {
        try {
          const smsMsg = `EstateOS VIP: Znaleziono idealne dopasowanie do Twojego radaru! ${offer.propertyType}, ${offer.district}, ${offer.price} PLN. Zobacz ofertę: https://estateos.pl/oferta/${offer.id}`;
          
          const params = new URLSearchParams();
          params.append('to', radar.phone);
          params.append('from', 'TEST');
          params.append('msg', smsMsg);

          await fetch('https://api2.smsplanet.pl/sms', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer BW936z97108280b73b5343b99b67b8d87488c529',
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params
          });
          sentCount++;
        } catch (smsErr) {
          console.error("Błąd wysyłki SMS do", radar.phone);
        }
      }
    }

    return NextResponse.json({ success: true, sentCount });

  } catch (error) {
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}

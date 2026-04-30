import { encryptSession, decryptSession } from '@/lib/sessionUtils';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { canonicalizeCity, canonicalizeDistrict, getDistrictsForCity, isStrictCity } from '@/lib/location/locationCatalog';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const cookieStore = await cookies();
    const session = cookieStore.get('estateos_session');
    
    if (!session) {
      return NextResponse.json({ success: false, message: 'Brak sesji' }, { status: 401 });
    }

    // Bezpieczne rozpakowanie ciasteczka (obsługuje nowy format JSON i stary format tekstowy)
    let emailToSearch = session.value;
    try {
       const parsedSession = decryptSession(session.value);
       if (parsedSession && parsedSession.email) {
           emailToSearch = parsedSession.email;
       }
    } catch(e) {}

    const user = await prisma.user.findUnique({ where: { email: emailToSearch } });
    if (!user) {
      return NextResponse.json({ success: false, message: 'Nie znaleziono użytkownika' }, { status: 404 });
    }

    // TWARDY ZAPIS PREFERENCJI DO BAZY DANYCH
    const normalizedCity = canonicalizeCity(body.city || 'Warszawa');
    const strictCity = isStrictCity(normalizedCity);
    const allowedDistricts = getDistrictsForCity(normalizedCity);
    const normalizedDistricts = Array.isArray(body.districts)
      ? body.districts
          .map((district: string) => canonicalizeDistrict(normalizedCity, district))
          .filter((district: string) => {
            if (!district) return false;
            if (!strictCity) return true;
            return allowedDistricts.some((entry) => entry.toLowerCase() === district.toLowerCase());
          })
      : [];

    if (strictCity && normalizedDistricts.length === 0) {
      return NextResponse.json({ success: false, message: `Wybierz dzielnicę z listy dla miasta ${normalizedCity}.` }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        searchType: body.type,
        searchRooms: body.rooms ? Number(body.rooms) : null,
        searchDistricts: normalizedDistricts.join(','),
        searchMaxPrice: body.maxPrice ? parseInt(String(body.maxPrice).replace(/\D/g, '')) : null,
          searchTransactionType: body.transactionType || 'all',
        searchAreaFrom: body.areaFrom ? parseInt(String(body.areaFrom).replace(/\D/g, '')) : null,
        searchAreaTo: body.areaTo ? parseInt(String(body.areaTo).replace(/\D/g, '')) : null,
        searchPlotArea: body.plotArea ? parseInt(String(body.plotArea).replace(/\D/g, '')) : null,
        searchAmenities: body.amenities ? body.amenities.join(',') : null,
        buyerType: body.buyerType || user.buyerType
      }
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Błąd aktualizacji radaru:", e);
    return NextResponse.json({ success: false, message: 'Błąd serwera' }, { status: 500 });
  }
}

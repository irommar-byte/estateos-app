import { encryptSession, decryptSession } from '@/lib/sessionUtils';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

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
    await prisma.user.update({
      where: { id: user.id },
      data: {
        searchType: body.type,
        searchRooms: body.rooms ? Number(body.rooms) : null,
        searchDistricts: body.districts ? body.districts.join(',') : null,
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

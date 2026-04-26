import { radarService } from '@/lib/services/radar.service';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const data = await req.json();
    console.log(`AUDYT: Tworzę ofertę dla użytkownika ${data.userId}`);

    const newOffer = await prisma.offer.create({
      data: {
        userId: parseInt(data.userId),
        title: data.title || 'Oferta z aplikacji',
        price: parseFloat(data.price) || 0,
        area: parseFloat(data.area) || 0,
        propertyType: data.propertyType || 'FLAT',
        transactionType: data.transactionType || 'SALE',
        city: data.city || 'Warszawa',
        district: data.district || 'OTHER',
        description: data.description || '',
        rooms: parseInt(data.rooms) || 0,
        floor: parseInt(data.floor) || 0,
        lat: parseFloat(data.lat) || 52.22,
        lng: parseFloat(data.lng) || 21.01,
        images: '[]',
        status: 'PENDING' // <--- BLOKADA: ZAWSZE DO WERYFIKACJI
      }
    });

    // Odpalamy radar w tle

    console.log("⚠️ API: Odpalam Radar z twardym AWAIT...");

    return NextResponse.json({ success: true, offer: newOffer });
  } catch (error: any) {
    console.error('BŁĄD TWORZENIA:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Na ten moment wymuszamy userId = 17, dopóki aplikacja na Macu nie przekaże prawidłowego tokenu z sesji
    const userId = 17; 

    let { expoPushToken, platform = 'IOS', deviceModel = 'Unknown', appVersion = '1.0' } = body;

    if (!expoPushToken) {
      return NextResponse.json({ error: 'Brak tokena w body' }, { status: 400 });
    }

    // ⚡ UPSERT (dodaj/zaktualizuj token urządzenia dla uzytkownika 17)
    const device = await prisma.device.upsert({
      where: {
        userId_expoPushToken: {
          userId,
          expoPushToken
        }
      },
      update: {
        isActive: true,
        lastSyncedAt: new Date()
      },
      create: {
        userId,
        expoPushToken,
        platform,
        deviceModel,
        appVersion,
        isActive: true
      }
    });

    console.log(`📱 Token zapisany w bazie dla UserID ${userId}: ${expoPushToken.slice(0,25)}...`);
    
    return NextResponse.json({ success: true, deviceId: device.id });

  } catch (error: any) {
    console.error('❌ Błąd zapisu urządzenia:', error?.message || error);
    return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 🔥 AUTH
    const authHeader = req.headers.get("authorization");
console.log("AUTH HEADER:", authHeader);
    console.log("BODY:", body);

    if (!authHeader) {
      return NextResponse.json({ error: 'Brak Authorization header' }, { status: 401 });
    }

    const rawToken = authHeader.split(" ")[1] || '';
    const token = rawToken.startsWith('Bearer ') ? rawToken.slice('Bearer '.length).trim() : rawToken.trim();
    if (!token) {
      return NextResponse.json({ error: 'Nieprawidłowy token' }, { status: 401 });
    }
    const decoded = jwt.decode(token) as any;

    const userId = Number(decoded?.id || decoded?.userId || decoded?.sub);
    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: 'Nieprawidłowy token' }, { status: 401 });
    }

    let { expoPushToken, platform = 'IOS', deviceModel = 'Unknown', appVersion = '1.0' } = body;

    if (!expoPushToken) {
      return NextResponse.json({ error: 'Brak tokena w body' }, { status: 400 });
    }

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

    console.log(`📱 Token zapisany dla user ${userId}: ${expoPushToken.slice(0,25)}...`);

    return NextResponse.json({ success: true, deviceId: device.id });

  } catch (error: any) {
    console.error('❌ Błąd zapisu urządzenia:', error?.message || error);
    return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 });
  }
}

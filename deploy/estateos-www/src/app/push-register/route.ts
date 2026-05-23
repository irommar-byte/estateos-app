import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const userId = 17; // testowo na sztywno

    const { expoPushToken, platform = 'IOS' } = body;

    if (!expoPushToken) {
      return NextResponse.json({ error: 'Brak expoPushToken' }, { status: 400 });
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
        updatedAt: new Date()
      },
      create: {
        userId,
        expoPushToken,
        platform,
        isActive: true
      }
    });

    console.log(`📱 TOKEN OK: ${expoPushToken.slice(0,20)}...`);

    return NextResponse.json({ success: true, deviceId: device.id });

  } catch (e: any) {
    console.error('❌ PUSH REGISTER ERROR:', e?.message || e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

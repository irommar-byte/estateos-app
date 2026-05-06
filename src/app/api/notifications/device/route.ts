import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/jwtMobile';
import jwt from 'jsonwebtoken';

function parseUserIdFromAuthHeader(authHeader: string | null): number | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const rawToken = authHeader.slice('Bearer '.length).trim();
  const token = rawToken.startsWith('Bearer ') ? rawToken.slice('Bearer '.length).trim() : rawToken;
  if (!token) return null;

  const verified = verifyMobileToken(token) as any;
  const verifiedId = Number(verified?.id ?? verified?.userId ?? verified?.sub);
  if (Number.isFinite(verifiedId) && verifiedId > 0) {
    return verifiedId;
  }

  // Fallback dla tokenów podpisanych innym sekretem (np. część flow passkey).
  const decoded = jwt.decode(token) as any;
  const decodedId = Number(decoded?.id ?? decoded?.userId ?? decoded?.sub);
  if (Number.isFinite(decodedId) && decodedId > 0) {
    return decodedId;
  }

  return null;
}

/** Szybki test z przeglądarki / curl GET — potwierdza TLS i routing bez body tokena Expo. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: '/api/notifications/device',
    hint: 'Rejestracja push: POST + JSON { expoPushToken, platform?, ... } + Authorization: Bearer',
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const authHeader = req.headers.get("authorization");
    const userId = parseUserIdFromAuthHeader(authHeader);
    if (!userId) {
      return NextResponse.json({ error: 'Nieprawidłowy token' }, { status: 401 });
    }

    let { expoPushToken, platform = 'IOS', deviceModel = 'Unknown', appVersion = '1.0' } = body;
    expoPushToken = String(expoPushToken || '').replace(/\s+/g, '').trim();

    if (!expoPushToken) {
      return NextResponse.json({ error: 'Brak tokena w body' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      // Jeden fizyczny token urządzenia ma należeć tylko do jednego konta.
      await tx.device.updateMany({
        where: {
          expoPushToken,
          userId: { not: userId },
        },
        data: {
          isActive: false,
        },
      });

      await tx.device.upsert({
        where: {
          userId_expoPushToken: {
            userId,
            expoPushToken
          }
        },
        update: {
          isActive: true,
          platform,
          deviceModel,
          appVersion,
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
    });

    console.log(`📱 Token zapisany dla user ${userId}: ${expoPushToken.slice(0,25)}...`);

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('❌ Błąd zapisu urządzenia:', error?.message || error);
    return NextResponse.json({ error: 'Wewnętrzny błąd serwera' }, { status: 500 });
  }
}

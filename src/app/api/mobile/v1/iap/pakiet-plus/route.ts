import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const PAKIET_PLUS_IOS_PRODUCT_ID = 'pl.estateos.app.pakiet_plus_30d';
const PAKIET_PLUS_ANDROID_PRODUCT_ID = 'pl.estateos.app.pakiet_plus_30d';
const PLUS_DAYS = 30;

function getTokenFromReq(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice('Bearer '.length).trim();
}

function getUserIdFromToken(token: string): number | null {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || '') as any;
    const id = Number(payload?.id ?? payload?.userId ?? payload?.sub);
    return Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = getTokenFromReq(req);
    if (!token) {
      return NextResponse.json({ success: false, message: 'Brak tokenu.' }, { status: 401 });
    }

    const userId = getUserIdFromToken(token);
    if (!userId) {
      return NextResponse.json({ success: false, message: 'Nieprawidłowy token.' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({} as any));
    const platform = String(body?.platform || '').toLowerCase();
    const productId = String(body?.productId || '');
    const transactionId = String(body?.transactionId || '');
    const purchaseToken = body?.purchaseToken ? String(body.purchaseToken) : null;
    const jwsRepresentation = body?.jwsRepresentation ? String(body.jwsRepresentation) : null;

    if (!platform || !productId || !transactionId) {
      return NextResponse.json(
        { success: false, message: 'Brakuje wymaganych pól (platform, productId, transactionId).' },
        { status: 400 }
      );
    }

    if (platform === 'ios' && productId !== PAKIET_PLUS_IOS_PRODUCT_ID) {
      return NextResponse.json({ success: false, message: 'Nieprawidłowy iOS productId.' }, { status: 400 });
    }
    if (platform === 'android' && productId !== PAKIET_PLUS_ANDROID_PRODUCT_ID) {
      return NextResponse.json({ success: false, message: 'Nieprawidłowy Android productId.' }, { status: 400 });
    }

    // Minimalna walidacja techniczna payloadu:
    if (platform === 'ios' && !jwsRepresentation) {
      return NextResponse.json({ success: false, message: 'Brak iOS jwsRepresentation.' }, { status: 400 });
    }
    if (platform === 'android' && !purchaseToken) {
      return NextResponse.json({ success: false, message: 'Brak Android purchaseToken.' }, { status: 400 });
    }

    // TODO (produkcyjnie): dodać pełną walidację sklepową
    // - iOS: App Store Server API (JWS)
    // - Android: Google Play Developer API (purchaseToken)

    const now = new Date();
    const current = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isPro: true, proExpiresAt: true },
    });

    if (!current) {
      return NextResponse.json({ success: false, message: 'Użytkownik nie istnieje.' }, { status: 404 });
    }

    const base = current.proExpiresAt && new Date(current.proExpiresAt) > now
      ? new Date(current.proExpiresAt)
      : now;

    const nextExpiry = new Date(base.getTime() + PLUS_DAYS * 24 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: userId },
      data: {
        isPro: false,
        proExpiresAt: null,
        planType: 'NONE',
        extraListings: { increment: 1 },
      },
    });

    return NextResponse.json({
      success: true,
      ok: true,
      backendRegistered: true,
      userId,
      slotGranted: true,
      note: 'Pakiet Plus zarejestrowany. Dodano 1 slot publikacji.',
    });
  } catch (error: any) {
    console.error('IAP PAKIET PLUS ERROR:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Błąd serwera.' },
      { status: 500 }
    );
  }
}

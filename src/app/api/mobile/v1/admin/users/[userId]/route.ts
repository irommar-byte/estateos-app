import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyMobileToken } from '@/lib/jwtMobile';
import jwt from 'jsonwebtoken';
import { resolveOfferPrimaryImage } from '@/lib/offers/primaryImage';

function extractToken(req: Request): string | null {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  const raw = String(authHeader || '').trim();
  if (!raw) return null;
  return raw.startsWith('Bearer ') ? raw.slice('Bearer '.length).trim() : raw;
}

function parseUserIdFromToken(token: string): number | null {
  const verified = verifyMobileToken(token) as any;
  const verifiedId = Number(verified?.id ?? verified?.userId ?? verified?.sub);
  if (Number.isFinite(verifiedId) && verifiedId > 0) return verifiedId;

  const decoded = jwt.decode(token) as any;
  const decodedId = Number(decoded?.id ?? decoded?.userId ?? decoded?.sub);
  if (Number.isFinite(decodedId) && decodedId > 0) return decodedId;
  return null;
}

export async function GET(
  req: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const token = extractToken(req);
    if (!token) {
      return NextResponse.json({ success: false, message: 'Brak autoryzacji' }, { status: 401 });
    }

    const requesterId = parseUserIdFromToken(token);
    if (!requesterId) {
      return NextResponse.json({ success: false, message: 'Niepoprawny token' }, { status: 401 });
    }

    const requester = await prisma.user.findUnique({
      where: { id: requesterId },
      select: { id: true, role: true },
    });
    if (!requester) {
      return NextResponse.json({ success: false, message: 'Niepoprawny token' }, { status: 401 });
    }
    if (requester.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: 'Brak uprawnień admina' }, { status: 403 });
    }

    const { userId } = await context.params;
    const targetUserId = Number(userId);
    if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
      return NextResponse.json({ success: false, message: 'Nieprawidłowy userId' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isVerified: true,
        createdAt: true,
        offers: {
          select: {
            id: true,
            title: true,
            price: true,
            status: true,
            images: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ success: false, message: 'Użytkownik nie istnieje' }, { status: 404 });
    }

    const userWithThumbnails = {
      ...user,
      offers: user.offers.map((offer) => {
        const thumbnail = resolveOfferPrimaryImage(offer as { images?: unknown; imageUrl?: unknown });
        return {
          ...offer,
          images: offer.images,
          thumbnail,
          imageUrl: thumbnail,
        };
      }),
    };

    return NextResponse.json({
      success: true,
      user: userWithThumbnails,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || 'Błąd serwera' }, { status: 500 });
  }
}


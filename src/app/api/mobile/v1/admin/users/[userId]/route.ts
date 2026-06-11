import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireMobileAdmin } from '@/lib/mobileAdminAuth';
import { resolveOfferPrimaryImage } from '@/lib/offers/primaryImage';
import { shapeRadarPreference } from '@/lib/radarPreferenceShape';
import { fetchRadarSearchHistoryForUser } from '@/lib/radarSearchHistoryService';

export async function GET(
  req: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const gate = await requireMobileAdmin(req);
    if (!gate.ok) return gate.response;

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
        planType: true,
        companyName: true,
        phoneVerifiedAt: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        lastLoginIp: true,
        createdAt: true,
        updatedAt: true,
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
        radarPreference: true,
      },
    });

    if (!user) {
      return NextResponse.json({ success: false, message: 'Użytkownik nie istnieje' }, { status: 404 });
    }

    const shapedRadar = shapeRadarPreference(user.radarPreference);
    const { searchParams } = new URL(req.url);
    const radarSearchHistory = await fetchRadarSearchHistoryForUser(
      targetUserId,
      searchParams.get('radarHistoryLimit') ?? searchParams.get('limit')
    );

    const userWithThumbnails = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      radarPreference: shapedRadar,
      RadarPreference: shapedRadar,
      radarSearchHistory,
      radar_search_history: radarSearchHistory,
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


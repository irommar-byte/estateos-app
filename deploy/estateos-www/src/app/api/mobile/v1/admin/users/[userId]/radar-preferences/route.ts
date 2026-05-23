import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireMobileAdmin } from '@/lib/mobileAdminAuth';
import { shapeRadarPreference } from '@/lib/radarPreferenceShape';

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

    const pref = await prisma.radarPreference.findUnique({
      where: { userId: targetUserId },
    });

    return NextResponse.json({
      success: true,
      radarPreference: shapeRadarPreference(pref),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Błąd serwera';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

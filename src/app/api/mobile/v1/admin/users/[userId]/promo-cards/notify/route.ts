export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { requireMobileAdmin } from '@/lib/mobileAdminAuth';
import { readJson } from '@/lib/mobileApiAuth';
import { getProfilePromoCardForUser } from '@/lib/profilePromoCards';
import { notificationService } from '@/lib/services/notification.service';

type RouteContext = { params: Promise<{ userId: string }> };

export async function POST(req: Request, context: RouteContext) {
  const gate = await requireMobileAdmin(req);
  if (!gate.ok) return gate.response;

  const { userId: userIdParam } = await context.params;
  const targetUserId = Number(userIdParam);
  if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
    return NextResponse.json({ success: false, message: 'Nieprawidłowy userId' }, { status: 400 });
  }

  const body = await readJson(req);
  const cardId = String(body?.cardId || '').trim();
  if (!cardId) {
    return NextResponse.json({ success: false, message: 'Brak cardId' }, { status: 400 });
  }

  const card = await getProfilePromoCardForUser(targetUserId, cardId);
  if (!card) {
    return NextResponse.json({ success: false, message: 'Kupon nie istnieje' }, { status: 404 });
  }

  const title = String(body?.title || card.title || 'Nowy kupon bonusowy').slice(0, 120);
  const subtitle = String(body?.subtitle || 'Zobacz w Profilu').slice(0, 120);
  const isBirthday = card.kind === 'birthday_coupon' || card.templateId === 'birthday_free_listing';

  try {
    await notificationService.sendPushToUser(targetUserId, {
      title: isBirthday ? '🎁 Kupon urodzinowy' : '🎁 Nowy kupon bonusowy',
      body: `${title} — ${subtitle}`,
      data: {
        kind: 'bonus_coupon_received',
        target: 'profile_bonus_coupons',
        couponId: card.id,
        couponKind: card.kind,
        deeplink: 'estateos://profil/kupony-bonusowe',
      },
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Push failed';
    if (message === 'NO_ACTIVE_DEVICES' || message === 'NO_VALID_EXPO_TOKENS') {
      return NextResponse.json({ success: true, pushSkipped: true, reason: message });
    }
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

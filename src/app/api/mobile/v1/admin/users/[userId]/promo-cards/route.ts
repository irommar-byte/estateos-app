export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { requireMobileAdmin } from '@/lib/mobileAdminAuth';
import { readJson } from '@/lib/mobileApiAuth';
import { createProfilePromoCard } from '@/lib/profilePromoCards';

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
  const title = String(body?.title || '').trim();
  if (!title) {
    return NextResponse.json({ success: false, message: 'Brak tytułu kuponu' }, { status: 400 });
  }

  try {
    const card = await createProfilePromoCard(targetUserId, {
      title,
      subtitle: body?.subtitle,
      meta: body?.meta,
      accentColor: body?.accentColor,
      iconName: body?.iconName,
      pillLabel: body?.pillLabel,
      templateId: body?.templateId,
      grantsFreeListing: body?.grantsFreeListing === true,
      purpose: body?.purpose,
      expiresAt: body?.expiresAt,
    });
    return NextResponse.json({ success: true, card });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Błąd serwera';
    const status = message === 'USER_NOT_FOUND' ? 404 : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
}

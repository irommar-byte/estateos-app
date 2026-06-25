import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import { getPasskeyOrigin } from '@/lib/env.server';
import {
  buildPortalOnboardingUrl,
  createPortalOnboardingInvite,
} from '@/lib/portalOnboardingInvite';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Brak uprawnień administratora.' }, { status: 401 });
  }

  const { token, expiresAt } = createPortalOnboardingInvite(admin.id);
  const origin = getPasskeyOrigin();
  const url = buildPortalOnboardingUrl(origin, token);

  return NextResponse.json({
    ok: true,
    url,
    token,
    expiresAt,
    path: `/dolacz?invite=${encodeURIComponent(token)}`,
  });
}

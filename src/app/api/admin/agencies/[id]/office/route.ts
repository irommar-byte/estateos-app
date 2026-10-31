import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/requireAdmin';
import {
  adminActivateOfficePlan,
  adminAdjustOfficeCredits,
  adminRevokeOfficePlan,
  getAdminOfficePlan,
} from '@/lib/admin/adminOfficePlan';

type Ctx = { params: Promise<{ id: string }> };

async function companyIdFrom(ctx: Ctx) {
  const id = Number((await ctx.params).id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/** Centrala: pakiet Partner biura i pula kredytów biurowych. */
export async function GET(_req: Request, ctx: Ctx) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const companyId = await companyIdFrom(ctx);
  if (!companyId) return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 });
  try {
    return NextResponse.json({ success: true, office: await getAdminOfficePlan(companyId) });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'Błąd' }, { status: 400 });
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const companyId = await companyIdFrom(ctx);
  if (!companyId) return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    const action = String(body.action || '');
    if (action === 'activate_plan') {
      await adminActivateOfficePlan({
        companyId,
        adminUserId: admin.id,
        planId: String(body.planId || ''),
        days: Number(body.days || 30),
        withCredits: Boolean(body.withCredits),
      });
    } else if (action === 'revoke_plan') {
      await adminRevokeOfficePlan(companyId);
    } else if (action === 'adjust_credits') {
      await adminAdjustOfficeCredits({ companyId, adminUserId: admin.id, delta: Number(body.delta), reason: String(body.reason || '') });
    } else {
      return NextResponse.json({ success: false, error: 'Nieznana akcja.' }, { status: 400 });
    }
    return NextResponse.json({ success: true, office: await getAdminOfficePlan(companyId) });
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : 'Nie udało się.' }, { status: 400 });
  }
}

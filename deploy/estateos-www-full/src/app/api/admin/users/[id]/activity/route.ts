import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { loadAdminUserActivity } from '@/lib/adminUserActivity';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await ctx.params;
    const userId = Number(id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid user id' }, { status: 400 });
    }

    const activity = await loadAdminUserActivity(userId);
    return NextResponse.json({ success: true, activity });
  } catch (error) {
    console.error('[ADMIN USER ACTIVITY]', error);
    return NextResponse.json({ success: false, error: 'Błąd bazy' }, { status: 500 });
  }
}

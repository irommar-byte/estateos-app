import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { getWalletSnapshotForUser, listWalletTimelineForUser } from '@/lib/walletLedger';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Brak uprawnień administratora' }, { status: 403 });
    }

    const { id } = await params;
    const userId = Number(id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ success: false, error: 'Nieprawidłowe ID użytkownika' }, { status: 400 });
    }

    const [snapshot, timeline] = await Promise.all([
      getWalletSnapshotForUser(userId),
      listWalletTimelineForUser(userId, 150),
    ]);

    return NextResponse.json({ success: true, userId, snapshot, timeline });
  } catch (error) {
    console.error('[ADMIN USER WALLET]', error);
    return NextResponse.json({ success: false, error: 'Błąd serwera' }, { status: 500 });
  }
}

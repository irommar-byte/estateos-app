import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import { getWalletSnapshotsForUserIds } from '@/lib/walletLedger';

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Brak uprawnień administratora' }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        planType: true,
        isPro: true,
        proExpiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const snapshots = await getWalletSnapshotsForUserIds(users.map((u) => u.id));

    const rows = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      planType: u.planType,
      isPro: u.isPro,
      proExpiresAt: u.proExpiresAt?.toISOString() ?? null,
      wallet: snapshots[u.id] ?? {
        credits: 0,
        plusExpiresAt: null,
        creditsActive: false,
        activeCoupons: 0,
        usedCoupons: 0,
        totalCoupons: 0,
        firstFreeUsed: false,
      },
    }));

    const totals = rows.reduce(
      (acc, row) => {
        acc.credits += row.wallet.credits;
        acc.activeCoupons += row.wallet.activeCoupons;
        acc.usedCoupons += row.wallet.usedCoupons;
        return acc;
      },
      { credits: 0, activeCoupons: 0, usedCoupons: 0 },
    );

    return NextResponse.json({ success: true, totals, rows });
  } catch (error) {
    console.error('[ADMIN WALLET OVERVIEW]', error);
    return NextResponse.json({ success: false, error: 'Błąd serwera' }, { status: 500 });
  }
}

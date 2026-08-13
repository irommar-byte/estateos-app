import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/adminAuth';
import {
  getWalletSnapshotForUser,
  listWalletTimelineForUser,
  logWalletCreditConsume,
  logWalletCreditGrant,
} from '@/lib/walletLedger';

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

/**
 * Admin: dodaj / odbierz kredyty PLUS (User.extraListings).
 * Body: { delta: number, reason?: string, plusExpiresAt?: string | null, setExpiresDays?: number }
 * - delta > 0 → grant
 * - delta < 0 → consume (nie zejdzie poniżej 0)
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const body = await req.json().catch(() => ({}));
    const delta = Number(body?.delta);
    if (!Number.isFinite(delta) || delta === 0 || !Number.isInteger(delta)) {
      return NextResponse.json(
        { success: false, error: 'Podaj całkowitą liczbę kredytów różną od zera (delta).' },
        { status: 400 },
      );
    }
    if (Math.abs(delta) > 500) {
      return NextResponse.json({ success: false, error: 'Jednorazowa zmiana max ±500 kredytów.' }, { status: 400 });
    }

    const reason = String(body?.reason || '').trim().slice(0, 240) || 'Korekta administratora';
    const setExpiresDaysRaw = body?.setExpiresDays;
    const setExpiresDays =
      setExpiresDaysRaw === undefined || setExpiresDaysRaw === null || setExpiresDaysRaw === ''
        ? null
        : Number(setExpiresDaysRaw);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, extraListings: true, plusExpiresAt: true, email: true, name: true },
    });
    if (!user) {
      return NextResponse.json({ success: false, error: 'Użytkownik nie istnieje.' }, { status: 404 });
    }

    const current = Math.max(0, Number(user.extraListings ?? 0));
    const next = Math.max(0, current + delta);
    const applied = next - current;
    if (applied === 0) {
      return NextResponse.json({
        success: true,
        unchanged: true,
        message: 'Saldo już wynosi 0 — nie można odebrać więcej.',
        snapshot: await getWalletSnapshotForUser(userId),
        timeline: await listWalletTimelineForUser(userId, 150),
      });
    }

    let plusExpiresAt: Date | null | undefined = undefined;
    if (body?.plusExpiresAt === null) {
      plusExpiresAt = null;
    } else if (typeof body?.plusExpiresAt === 'string' && body.plusExpiresAt.trim()) {
      const parsed = new Date(body.plusExpiresAt);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ success: false, error: 'Nieprawidłowa data plusExpiresAt.' }, { status: 400 });
      }
      plusExpiresAt = parsed;
    } else if (setExpiresDays != null && Number.isFinite(setExpiresDays) && setExpiresDays > 0) {
      plusExpiresAt = new Date(Date.now() + Math.floor(setExpiresDays) * 24 * 60 * 60 * 1000);
    } else if (applied > 0 && !user.plusExpiresAt) {
      // Przy nadaniu kredytów bez ważności — domyślnie 30 dni.
      plusExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        extraListings: next,
        ...(plusExpiresAt !== undefined ? { plusExpiresAt } : {}),
      },
    });

    const refId = `admin:${admin.id}:${Date.now()}`;
    if (applied > 0) {
      await logWalletCreditGrant({
        userId,
        amount: applied,
        purpose: 'admin_adjust',
        referenceType: 'admin',
        referenceId: refId,
        label: `Admin +${applied}: ${reason}`,
        meta: { adminId: admin.id, reason, delta: applied },
      });
    } else {
      await logWalletCreditConsume({
        userId,
        amount: Math.abs(applied),
        purpose: 'admin_adjust',
        referenceType: 'admin',
        referenceId: refId,
        label: `Admin −${Math.abs(applied)}: ${reason}`,
        meta: { adminId: admin.id, reason, delta: applied },
      });
    }

    const [snapshot, timeline] = await Promise.all([
      getWalletSnapshotForUser(userId),
      listWalletTimelineForUser(userId, 150),
    ]);

    return NextResponse.json({
      success: true,
      previous: current,
      next,
      applied,
      snapshot,
      timeline,
    });
  } catch (error) {
    console.error('[ADMIN USER WALLET POST]', error);
    return NextResponse.json({ success: false, error: 'Błąd serwera' }, { status: 500 });
  }
}

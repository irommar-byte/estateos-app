import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { decryptSession } from '@/lib/sessionUtils';
import { shapeAdminUserDetail } from '@/lib/adminUserDetail';
import { getWalletSnapshotsForUserIds } from '@/lib/walletLedger';

async function requireAdmin() {
  const cookieStore = await cookies();
  const sessionToken =
    cookieStore.get('estateos_session')?.value ||
    cookieStore.get('luxestate_user')?.value ||
    null;
  if (!sessionToken) return null;

  const session = decryptSession(sessionToken);
  const email = String(session?.email || '').trim().toLowerCase();
  if (!email) return null;

  return prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });
}

/** Lista CENTRALA — ograniczona głębokość, żeby zakładka otwierała się szybko. */
const USER_ADMIN_INCLUDE = {
  offers: {
    select: { id: true, title: true, price: true, status: true },
    orderBy: { createdAt: 'desc' as const },
    take: 40,
  },
  radarPreference: true,
  radarSearchHistory: {
    orderBy: { searchedAt: 'desc' as const },
    take: 5,
  },
  discoveryProfile: true,
  devices: {
    orderBy: { lastSyncedAt: 'desc' as const },
    take: 6,
  },
  _count: {
    select: {
      sessions: true,
      Authenticator: true,
    },
  },
  agencyMembership: {
    include: {
      company: { select: { id: true, name: true, slug: true } },
    },
  },
};

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const rows = await prisma.user.findMany({
      include: USER_ADMIN_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    const snapshots = await getWalletSnapshotsForUserIds(rows.map((row) => row.id));
    const users = rows.map((row) => {
      const shaped = shapeAdminUserDetail(row as Parameters<typeof shapeAdminUserDetail>[0]);
      return { ...shaped, wallet: snapshots[row.id] };
    });

    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error('[ADMIN USERS GET]', error);
    return NextResponse.json({ success: false, error: 'Błąd bazy' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id, role, name, email } = await req.json();
    const userId = Number(id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid user id' }, { status: 400 });
    }
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role, name, email },
    });
    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

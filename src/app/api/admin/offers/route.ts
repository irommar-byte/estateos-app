import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { decryptSession } from '@/lib/sessionUtils';

type AdminUser = { id: number; role: string } | null;

async function requireAdmin(): Promise<AdminUser> {
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

function normalizeStatus(rawStatus: unknown): 'PENDING' | 'ACTIVE' | 'ARCHIVED' | 'REJECTED' {
  const s = String(rawStatus || '').trim().toUpperCase();
  if (s === 'ACTIVE') return 'ACTIVE';
  if (s === 'ARCHIVED') return 'ARCHIVED';
  if (s === 'REJECTED') return 'REJECTED';
  return 'PENDING';
}

export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const offers = await prisma.offer.findMany({ include: { user: true }, orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ success: true, offers });
  } catch (error) { return NextResponse.json({ success: false, error: String(error) }, { status: 500 }); }
}

export async function PUT(req: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id, status } = await req.json();
    const normalizedStatus = normalizeStatus(status);

    // === SILNIK ALERTÓW - tylko przy zmianie na ACTIVE ===
    const existing = await prisma.offer.findUnique({ where: { id: Number(id) } });

    const updated = await prisma.offer.update({ where: { id: Number(id) }, data: { status: normalizedStatus } });

    console.log("STATUS CHECK:", { before: existing?.status, after: normalizedStatus });

    if (existing?.status !== 'ACTIVE' && normalizedStatus === 'ACTIVE') {
      const { radarService } = await import("@/lib/services/radar.service");
      await radarService.matchNewOffer(updated);
    }

    return NextResponse.json({ success: true, offer: updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
    await prisma.offer.delete({ where: { id: Number(id) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

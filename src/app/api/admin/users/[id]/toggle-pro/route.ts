import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { decryptSession } from '@/lib/sessionUtils';
import { shapeMobileUser } from '@/lib/mobileUserShape';
import { buildInvestorProGrantData, buildInvestorProRevokeData } from '@/lib/investorProGrant';

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

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Brak uprawnień administratora' }, { status: 403 });
    }

    const { id } = await params;
    const userId = Number(id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ error: 'Nieprawidłowe ID użytkownika' }, { status: 400 });
    }

    const body = await req.json();
    const action = String(body?.action || '').trim().toLowerCase();

    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      return NextResponse.json({ error: 'Użytkownik nie istnieje' }, { status: 404 });
    }

    const updatedData =
      action === 'give' ? buildInvestorProGrantData() : action === 'take' ? buildInvestorProRevokeData() : null;

    if (!updatedData) {
      return NextResponse.json({ error: 'Nieprawidłowa akcja (give | take)' }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: updatedData,
    });

    const shaped = shapeMobileUser(updated);

    return NextResponse.json({
      success: true,
      isPro: shaped.isPro,
      planType: shaped.planType,
      proExpiresAt: shaped.proExpiresAt,
      user: shaped,
    });
  } catch (error) {
    console.error('TOGGLE PRO ERROR:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}

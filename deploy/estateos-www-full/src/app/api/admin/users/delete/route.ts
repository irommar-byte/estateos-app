import { NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { decryptSession } from '@/lib/sessionUtils';

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

 

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await req.json();
    const userId = Number(id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ error: "Brak ID" }, { status: 400 });
    }

    // Kaskadowe usunięcie użytkownika (i jego powiązanych danych)
    await prisma.offer.deleteMany({
      where: { userId }
    });
    await prisma.user.delete({
      where: { id: userId }
    });

    return NextResponse.json({ success: true, message: "Użytkownik usunięty permanentnie." });
  } catch (error) {
    console.error("Błąd usuwania użytkownika:", error);
    return NextResponse.json({ error: "Błąd serwera podczas usuwania." }, { status: 500 });
  }
}

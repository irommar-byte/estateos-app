import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { mobileBearerUserId, readJson } from '@/lib/mobileApiAuth';

export async function POST(req: Request) {
  try {
    const tokenUserId = mobileBearerUserId(req);
    const body = await readJson(req);
    const requestedUserId = Number(body?.userId);
    const userId = tokenUserId || requestedUserId;
    const code = String(body?.code || '').trim();

    if (!tokenUserId && !Number.isFinite(requestedUserId)) {
      return NextResponse.json({ success: false, message: 'Brak autoryzacji lub userId' }, { status: 401 });
    }
    if (tokenUserId && Number.isFinite(requestedUserId) && requestedUserId > 0 && requestedUserId !== tokenUserId) {
      return NextResponse.json({ success: false, message: 'Błędny użytkownik w żądaniu' }, { status: 403 });
    }
    if (!Number.isFinite(userId) || userId <= 0 || !code) {
      return NextResponse.json({ success: false, message: 'Nieprawidłowy payload' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: Number(userId) }
    });

    if (!user || user.otpCode !== code) {
      return NextResponse.json({ success: false, message: 'Nieprawidłowy kod.' }, { status: 400 });
    }

    if (user.otpExpiry && new Date() > user.otpExpiry) {
      return NextResponse.json({ success: false, message: 'Kod wygasł.' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: Number(userId) },
      data: { phoneVerifiedAt: new Date(), otpCode: null, otpExpiry: null }
    });

    return NextResponse.json({ success: true, message: 'Telefon zweryfikowany!' });
  } catch (error: any) {
    console.error('[MOBILE SMS VERIFY]', error);
    return NextResponse.json({ success: false, message: 'Błąd serwera' }, { status: 500 });
  }
}

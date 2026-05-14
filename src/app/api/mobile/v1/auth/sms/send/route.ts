import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendSMS } from '@/lib/sms';
import { mobileBearerUserId, readJson } from '@/lib/mobileApiAuth';

export async function POST(req: Request) {
  try {
    const tokenUserId = mobileBearerUserId(req);
    const body = await readJson(req);
    const requestedUserId = Number(body?.userId);
    const userId = tokenUserId || requestedUserId;

    if (!tokenUserId && !Number.isFinite(requestedUserId)) {
      return NextResponse.json({ success: false, message: 'Brak autoryzacji lub userId' }, { status: 401 });
    }
    if (tokenUserId && Number.isFinite(requestedUserId) && requestedUserId > 0 && requestedUserId !== tokenUserId) {
      return NextResponse.json({ success: false, message: 'Błędny użytkownik w żądaniu' }, { status: 403 });
    }
    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ success: false, message: 'Nieprawidłowy userId' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: Number(userId) }
    });

    if (!user || !user.phone) {
      return NextResponse.json({ success: false, message: 'Brak numeru telefonu' }, { status: 400 });
    }

    const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.user.update({
      where: { id: Number(userId) },
      data: { otpCode, otpExpiry: expiry }
    });

    console.log("📲 WYSYŁAM SMS:", user.phone, otpCode);

    await sendSMS(user.phone, `Kod EstateOS: ${otpCode}`);

    return NextResponse.json({ success: true, message: 'Kod został wysłany.' });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ success: false, message: 'Błąd serwera' }, { status: 500 });
  }
}

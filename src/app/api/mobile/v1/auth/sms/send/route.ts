import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendSMS } from '@/lib/sms';
import { parsePhoneToE164 } from '@/lib/phoneE164';

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();

    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
    });

    if (!user || !user.phone) {
      return NextResponse.json({ success: false, message: 'Brak numeru telefonu' }, { status: 400 });
    }

    const e164 = parsePhoneToE164(user.phone);

    const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.user.update({
      where: { id: Number(userId) },
      data: { otpCode, otpExpiry: expiry },
    });

    console.log('📲 WYSYŁAM SMS:', e164, otpCode);

    await sendSMS(user.phone, `Kod EstateOS: ${otpCode}`);

    return NextResponse.json({ success: true, message: 'Kod został wysłany.' });
  } catch (error: any) {
    console.error(error);
    const msg = String(error?.message || error);
    if (msg.includes('Nieprawidłowy numer') || msg.includes('Brak numeru')) {
      return NextResponse.json({ success: false, message: msg }, { status: 400 });
    }
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const { userId, code } = await req.json();

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
      data: { isVerified: true, otpCode: null, otpExpiry: null }
    });

    return NextResponse.json({ success: true, message: 'Konto zweryfikowane!' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

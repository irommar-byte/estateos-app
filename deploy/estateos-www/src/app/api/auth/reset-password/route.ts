import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import nodemailer from 'nodemailer';
import bcrypt from 'bcrypt';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { identifier, otp, newPassword } = await req.json();

    const clean = identifier?.trim();
    const isEmail = clean?.includes('@');

    let user = null;

    if (isEmail) {
      user = await prisma.user.findUnique({
        where: { email: clean.toLowerCase() }
      });
    }

    if (!user) {
      return NextResponse.json({ error: "Nie znaleziono użytkownika" }, { status: 400 });
    }

    // ===== SEND OTP =====
    if (!otp && !newPassword) {
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpiry = new Date(Date.now() + 15 * 60 * 1000);

      await prisma.user.update({
        where: { id: user.id },
        data: { otpCode, otpExpiry }
      });

      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST?.trim(),
        port: Number(process.env.EMAIL_PORT) || 587,
        secure: true,
        auth: {
          user: process.env.EMAIL_USER?.trim(),
          pass: process.env.EMAIL_PASS?.trim()
        }
      });

      await transporter.sendMail({
        from: '"EstateOS" <powiadomienia@estateos.pl>',
        to: user.email,
        subject: "Kod resetu hasła",
        html: `<h2>Kod: ${otpCode}</h2>`
      });

      return NextResponse.json({ success: true });
    }

    // ===== RESET PASSWORD =====
    if (!user.otpCode || user.otpCode !== otp || !user.otpExpiry || user.otpExpiry < new Date()) {
      return NextResponse.json({ error: "Nieprawidłowy kod" }, { status: 400 });
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        otpCode: null,
        otpExpiry: null
      }
    });

    console.log("✅ PASSWORD CHANGED:", user.email);

    return NextResponse.json({ success: true });

  } catch (e: any) {
    console.error("RESET ERROR:", e);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }
}

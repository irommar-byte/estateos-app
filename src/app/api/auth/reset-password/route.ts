import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import nodemailer from 'nodemailer';
import bcrypt from 'bcrypt';

function normalizePhone(input: string) {
  const clean = input.replace(/\D/g, '');
  return clean.startsWith('48') ? clean : '48' + clean;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { identifier, otp, newPassword } = body;

    const clean = identifier?.trim();

    const isEmail = clean?.includes('@');
    const phone = !isEmail ? normalizePhone(clean) : null;

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: clean?.toLowerCase() },
          { phone }
        ]
      }
    });

    // ===== REQUEST OTP =====
    if (!otp && !newPassword) {
      if (!user) {
        return NextResponse.json({ success: true });
      }

      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpiry = new Date(Date.now() + 15 * 60 * 1000);

      await prisma.user.update({
        where: { id: user.id },
        data: { otpCode, otpExpiry }
      });

      try {
        const transporter = nodemailer.createTransport({ connectionTimeout: 5000, socketTimeout: 5000,
          host: process.env.EMAIL_HOST?.trim(),
          port: Number(process.env.EMAIL_PORT) || 587,
          secure: true,
          auth: {
            user: process.env.EMAIL_USER?.trim(),
            pass: process.env.EMAIL_PASS?.trim()
          }
        });

        if (user.email) {
          await transporter.sendMail({
            from: '"EstateOS" <powiadomienia@estateos.pl>',
            to: user.email,
            subject: "Kod resetu hasła",
            html: `<h2>Kod: ${otpCode}</h2>`
          });
        } else if (user.phone) {
          const params = new URLSearchParams();
          params.append('to', user.phone);
          params.append('msg', `Kod resetu: ${otpCode}`);

          await fetch('https://api2.smsplanet.pl/sms', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer BW936...',
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params
          });
        }

      } catch (e) {}

      return NextResponse.json({ success: true });
    }

    // ===== RESET PASSWORD =====
    if (!user || !user.otpCode || user.otpCode !== otp || !user.otpExpiry || user.otpExpiry < new Date()) {
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

    return NextResponse.json({ success: true });

  } catch (e) {
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }
}

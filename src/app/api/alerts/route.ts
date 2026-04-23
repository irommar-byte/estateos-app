import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import nodemailer from 'nodemailer';

// TWARDY KONFIG GMAILA Z SSL
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: { 
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS 
  }
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let user = await prisma.user.findUnique({ where: { email: body.email } });
    const generatedPassword = Math.random().toString(36).slice(-8);
    let isNewUser = false;

    if (!user) {
      user = await prisma.user.create({
        data: { email: body.email, password: generatedPassword, phone: body.phone || null, name: "Poszukujący" }
      });
      isNewUser = true;
    }

    const newAlert = await prisma.alert.create({
      data: {
        email: body.email,
        propertyType: body.propertyType && body.propertyType.length > 0 ? body.propertyType.join(",") : "Wszystkie",
        district: body.district && body.district.length > 0 ? body.district.join(",") : "Wszystkie",
        maxPrice: parseInt(body.maxPrice.replace(/\D/g, '')) || 999999999
      }
    });

    if (isNewUser) {
      const mailOptions = {
        from: `"EstateOS Premium" <${process.env.EMAIL_USER}>`,
        to: body.email,
        subject: "Witaj w EstateOS™! Twoje konto jest gotowe.",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #000; color: #fff; padding: 40px; border-radius: 24px;">
            <h1 style="font-size: 28px; font-weight: 800; letter-spacing: -1px; margin-bottom: 5px;">EstateOS™</h1>
            <p style="color: #10b981; font-size: 12px; margin-bottom: 30px; text-transform: uppercase; letter-spacing: 2px; font-weight: bold;">Konto Aktywowane</p>
            <p style="font-size: 18px; line-height: 1.5; margin-bottom: 30px; color: #ddd;">Cieszymy się, że do nas dołączyłeś. Zapisaliśmy Twoje preferencje.</p>
            <div style="background-color: #111; padding: 25px; border-radius: 16px; margin-bottom: 30px; border: 1px solid #222;">
              <p style="color: #aaa; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-top: 0;">Twoje dane logowania</p>
              <p style="margin: 10px 0; font-size: 16px;">E-mail: <strong style="color: #fff;">${body.email}</strong></p>
              <p style="margin: 10px 0; font-size: 16px;">Hasło: <strong style="color: #10b981;">${generatedPassword}</strong></p>
            </div>
            <a href="http://nieruchomosci.mycloudnas.com/login" style="display: block; text-align: center; background-color: #fff; color: #000; text-decoration: none; padding: 18px 30px; border-radius: 50px; font-weight: bold; font-size: 16px;">Przejdź do Panelu ➔</a>
          </div>
        `
      };
      
      // Sprawdzamy czy pójdzie
      console.log("-> Inicjalizacja wysyłki e-mail powitalnego...");
      await transporter.sendMail(mailOptions);
      console.log("-> SUKCES: E-mail powitalny wysłany!");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("-> BLĄD SERWERA LUB WYSYŁKI E-MAIL:", error);
    return NextResponse.json({ error: "Błąd serwera" }, { status: 500 });
  }
}

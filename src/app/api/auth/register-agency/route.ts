import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { agencyName, name, email, phone, password } = body;

    const cleanEmail = email.toLowerCase().trim();
    const cleanPhone = phone.replace(/\D/g, '');
    const finalPhone = cleanPhone.startsWith('48') ? cleanPhone : '48' + cleanPhone;

    const existingEmail = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existingEmail) return NextResponse.json({ error: "Ten adres e-mail jest już zarejestrowany." }, { status: 400 });

    const existingPhone = await prisma.user.findFirst({ where: { phone: finalPhone } });
    if (existingPhone) return NextResponse.json({ error: "Ten numer telefonu jest już w użyciu." }, { status: 400 });

    const user = await prisma.user.create({
      data: {
      accountType: "AGENCY",
      role: "AGENCY",
        email: cleanEmail,
        password,
        name: `${name} (${agencyName})`,
        phone: finalPhone,
        
        buyerType: "agency",
        isVerified: true
      }
    });

    return NextResponse.json({ success: true, userId: user.id });
  } catch (error) {
    return NextResponse.json({ error: "Błąd serwera przy rejestracji." }, { status: 500 });
  }
}

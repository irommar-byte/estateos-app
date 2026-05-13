import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { expandPhoneSearchVariants, normalizePhoneForStorage } from "@/lib/phoneLookup";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { agencyName, name, email, phone, password } = body;

    const cleanEmail = email.toLowerCase().trim();
    const storedPhone = normalizePhoneForStorage(phone);
    if (!storedPhone) {
      return NextResponse.json({ error: "Nieprawidłowy numer telefonu." }, { status: 400 });
    }

    const existingEmail = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existingEmail) return NextResponse.json({ error: "Ten adres e-mail jest już zarejestrowany." }, { status: 400 });

    const phoneVariants = expandPhoneSearchVariants(phone);
    const existingPhone = await prisma.user.findFirst({
      where: { OR: phoneVariants.map((p) => ({ phone: p })) },
    });
    if (existingPhone) return NextResponse.json({ error: "Ten numer telefonu jest już w użyciu." }, { status: 400 });

    const user = await prisma.user.create({
      data: {
        role: "USER",
        planType: "AGENCY",
        email: cleanEmail,
        password,
        name: name,
        companyName: agencyName,
        phone: storedPhone,
        isVerified: true
      }
    });

    return NextResponse.json({ success: true, userId: user.id });
  } catch (error) {
    return NextResponse.json({ error: "Błąd serwera przy rejestracji." }, { status: 500 });
  }
}

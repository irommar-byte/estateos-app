import { NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';

 

export async function POST(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Brak ID" }, { status: 400 });

    // Kaskadowe usunięcie użytkownika (i jego powiązanych danych)
    await prisma.offer.deleteMany({
      where: { userId: id }
    });
    await prisma.user.delete({
      where: { id }
    });

    return NextResponse.json({ success: true, message: "Użytkownik usunięty permanentnie." });
  } catch (error) {
    console.error("Błąd usuwania użytkownika:", error);
    return NextResponse.json({ error: "Błąd serwera podczas usuwania." }, { status: 500 });
  }
}

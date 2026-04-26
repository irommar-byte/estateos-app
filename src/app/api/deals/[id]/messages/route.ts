import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POBIERANIE WIADOMOŚCI (GET)
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const dealId = parseInt(id);
    if (isNaN(dealId)) {
        return NextResponse.json({ success: false, error: 'Nieprawidłowe ID transakcji' }, { status: 400 });
    }

    const messages = await prisma.dealMessage.findMany({
      where: { dealId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ success: true, messages });
  } catch (error: any) {
    console.error('Błąd pobierania wiadomości:', error.message);
    return NextResponse.json({ success: false, error: 'Błąd serwera' }, { status: 500 });
  }
}

// WYSYŁANIE WIADOMOŚCI (POST)
export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const dealId = parseInt(id);
    const body = await req.json();
    const { content, senderId } = body;

    if (!content || !senderId) {
        return NextResponse.json({ success: false, error: 'Brak treści lub nadawcy' }, { status: 400 });
    }

    const newMessage = await prisma.dealMessage.create({
      data: {
        dealId,
        senderId: parseInt(senderId),
        content,
      }
    });

    return NextResponse.json({ success: true, message: newMessage });
  } catch (error: any) {
    console.error('Błąd wysyłania wiadomości:', error.message);
    return NextResponse.json({ success: false, error: 'Błąd serwera' }, { status: 500 });
  }
}

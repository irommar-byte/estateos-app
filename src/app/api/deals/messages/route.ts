import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dealId = searchParams.get('dealId');

    if (!dealId) {
      return NextResponse.json({ success: false, error: 'Brak dealId' }, { status: 400 });
    }

    const messages = await prisma.dealMessage.findMany({
      where: { dealId: parseInt(dealId) },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ success: true, messages });
  } catch (error: any) {
    console.error('Błąd pobierania wiadomości:', error.message);
    return NextResponse.json({ success: false, error: 'Błąd serwera' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dealId = searchParams.get('dealId');
    
    if (!dealId) {
      return NextResponse.json({ success: false, error: 'Brak dealId w URL' }, { status: 400 });
    }

    const body = await req.json();
    const { content, senderId } = body;

    if (!content || !senderId) {
        return NextResponse.json({ success: false, error: 'Brak treści lub nadawcy' }, { status: 400 });
    }

    const newMessage = await prisma.dealMessage.create({
      data: {
        dealId: parseInt(dealId),
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

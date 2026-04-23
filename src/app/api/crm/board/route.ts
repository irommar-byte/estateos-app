import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(req: Request) {
  try {
    const { id, status } = await req.json();
    if (!id || !status) return NextResponse.json({ error: 'Brak danych' }, { status: 400 });

    await prisma.appointment.update({
      where: { id: String(id) },
      data: { status }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Brak ID' }, { status: 400 });
    await prisma.appointment.delete({ where: { id: String(id) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}

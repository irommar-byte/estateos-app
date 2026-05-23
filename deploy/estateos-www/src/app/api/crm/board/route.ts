import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AppointmentStatus } from '@prisma/client';

export async function PUT(req: Request) {
  try {
    const { id, status } = await req.json();
    if (!id || !status) return NextResponse.json({ error: 'Brak danych' }, { status: 400 });
    const numericId = Number(id);
    const normalizedStatus = String(status).toUpperCase();
    const allowedStatuses: AppointmentStatus[] = ['PENDING', 'ACCEPTED', 'DECLINED', 'RESCHEDULED'];
    if (Number.isNaN(numericId) || !allowedStatuses.includes(normalizedStatus as AppointmentStatus)) {
      return NextResponse.json({ error: 'Nieprawidłowe dane' }, { status: 400 });
    }

    await prisma.appointment.update({
      where: { id: numericId },
      data: { status: normalizedStatus as AppointmentStatus }
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
    const numericId = Number(id);
    if (Number.isNaN(numericId)) return NextResponse.json({ error: 'Nieprawidłowe ID' }, { status: 400 });
    await prisma.appointment.delete({ where: { id: numericId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}

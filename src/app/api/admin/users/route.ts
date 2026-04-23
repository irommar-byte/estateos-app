import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      include: {
        offers: {
          select: { id: true, title: true, price: true, status: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json({ success: true, users });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Błąd bazy" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { id, role, name, email } = await req.json();
    const updated = await prisma.user.update({
      where: { id },
      data: { role, name, email }
    });
    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

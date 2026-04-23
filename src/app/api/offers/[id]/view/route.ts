import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request, context: any) {
  try {
    const resolvedParams = await context.params;
    await prisma.offer.update({
      where: { id: parseInt(resolvedParams.id) },
      data: { views: { increment: 1 } }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Błąd licznika' }, { status: 500 });
  }
}

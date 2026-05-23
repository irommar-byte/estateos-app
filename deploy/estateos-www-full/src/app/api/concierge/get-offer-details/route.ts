import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { leadId } = await req.json();
    const lead = await prisma.leadTransfer.findUnique({ where: { id: leadId } });
    if (!lead) return NextResponse.json({ price: '0', title: 'Brak danych' });
    
    const offer = await prisma.offer.findUnique({ where: { id: lead.offerId } });
    return NextResponse.json({ price: offer?.price || '0', title: offer?.title || 'Zlecenie Prywatne' });
  } catch(e) {
    return NextResponse.json({ price: '0', title: 'Błąd pobierania' });
  }
}

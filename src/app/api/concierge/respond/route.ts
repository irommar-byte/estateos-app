import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const { leadId, status, commissionRate, commissionTerms } = await req.json();
    
    // Pobieramy zlecenie, żeby wiedzieć do kogo wysłać dzwoneczek
    const lead = await prisma.leadTransfer.findUnique({ where: { id: leadId } });
    if (!lead) return NextResponse.json({ error: 'Nie znaleziono zapytania' }, { status: 404 });

    // Aktualizujemy status i warunki w bazie
    await prisma.leadTransfer.update({
      where: { id: leadId },
      data: { 
         status, 
         commissionRate: commissionRate ? parseFloat(commissionRate) : null, 
         commissionTerms 
      }
    });

    // Jeśli to nowa propozycja, strzelamy powiadomieniem do właściciela mieszkania
    if (status === 'TERMS_PROPOSED') {
       await prisma.notification.create({
         data: {
           userId: lead.ownerId,
           title: '🔥 Nowa propozycja od Agencji',
           message: `Ekspert przeanalizował Twoją ofertę i zaproponował ${commissionRate}% prowizji. Sprawdź szczegóły i zaakceptuj warunki w swoim panelu.`,
           type: 'SYSTEM',
           link: '/moje-konto'
         }
       });
    }

    return NextResponse.json({ success: true });
  } catch(e) { 
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 }); 
  }
}
import { encryptSession, decryptSession } from '@/lib/sessionUtils';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    const { targetId, rating, comment } = await req.json();
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('luxestate_user') || cookieStore.get('estateos_session');
    if (!sessionCookie) return NextResponse.json({ error: 'Brak autoryzacji' }, { status: 401 });

    let sessionData: any = {}; try { sessionData = decryptSession(sessionCookie.value); } catch(e) {}
    let reviewerId = sessionData.id;
    if(!reviewerId && sessionData.email) {
      const u = await prisma.user.findFirst({ where: { email: sessionData.email }});
      if(u) reviewerId = u.id;
    }

    const review = await prisma.review.create({
      data: {
        reviewerId: Number(reviewerId),
        targetId: Number(targetId),
        rating: Number(rating),
        comment
      }
    });

    // Powiadomienie o opinii
    await prisma.notification.create({
       data: {
         userId: Number(targetId),
         title: `⭐ Otrzymałeś nową opinię: ${rating}/5`,
         message: comment ? `"${comment}"` : "Użytkownik ocenił współpracę pozytywnie.",
         type: "INFO"
       }
    });

    return NextResponse.json({ success: true, review });
  } catch(e) { return NextResponse.json({ error: 'Błąd' }, { status: 500 }); }
}

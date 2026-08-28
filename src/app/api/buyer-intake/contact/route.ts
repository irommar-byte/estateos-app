import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  BUYER_MISSION_COOKIE,
  BUYER_MISSION_MAX_AGE_SEC,
  decodeBuyerMissionCookie,
  encodeBuyerMissionCookie,
  mergeBuyerMission,
  resolveBuyerIntakeAgent,
} from '@/lib/buyerIntake.server';
import { persistBuyerIntakeContact } from '@/lib/buyerIntakePersist.server';
import { isBuyerStep3Complete, validateBuyerStep4Contact } from '@/lib/buyerIntakeShared';

export const dynamic = 'force-dynamic';

function setMissionCookie(res: NextResponse, encoded: string) {
  res.cookies.set(BUYER_MISSION_COOKIE, encoded, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: BUYER_MISSION_MAX_AGE_SEC,
  });
}

export async function POST(req: Request) {
  try {
    const agent = await resolveBuyerIntakeAgent();
    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Kanał wyszukiwania jest tymczasowo niedostępny.' },
        { status: 503 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const cookieStore = await cookies();
    const existing = decodeBuyerMissionCookie(cookieStore.get(BUYER_MISSION_COOKIE)?.value);
    const mission = mergeBuyerMission(existing, agent.userId, {});

    if (!isBuyerStep3Complete(mission)) {
      return NextResponse.json(
        { success: false, error: 'Najpierw uzupełnij kryteria wyszukiwania.' },
        { status: 422 },
      );
    }

    const contact = validateBuyerStep4Contact(body);
    if (!contact.ok) {
      return NextResponse.json({ success: false, error: contact.error }, { status: 422 });
    }

    const phone = contact.phone;

    const result = await persistBuyerIntakeContact({
      mission,
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone,
    });

    const nextMission = mergeBuyerMission(mission, agent.userId, {
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone,
      clientId: result.clientId,
      consentContact: true,
      step: 5,
    });

    const encoded = encodeBuyerMissionCookie(nextMission);
    const res = NextResponse.json({
      success: true,
      clientId: result.clientId,
      deskCaseId: result.deskCaseId,
      reusedClient: result.reusedClient,
      portalToken: result.portalToken,
      intelligenceSent: result.intelligenceSent,
      firstOfferId: result.firstOfferId,
      welcomeEmailSent: result.welcomeEmailSent,
    });
    setMissionCookie(res, encoded);
    return res;
  } catch (error) {
    console.error('[BUYER INTAKE CONTACT]', error);
    return NextResponse.json(
      { success: false, error: 'Nie udało się zapisać danych kontaktowych.' },
      { status: 500 },
    );
  }
}

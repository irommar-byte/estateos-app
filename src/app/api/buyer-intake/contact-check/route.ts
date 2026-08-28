import { NextResponse } from 'next/server';
import { findDuplicateAgencyClients } from '@/lib/crm/clientDuplicate';
import { resolveBuyerIntakeAgent } from '@/lib/buyerIntake.server';
import { normalizeBuyerContactEmail } from '@/lib/buyerIntakeShared';
import { normalizePhoneE164 } from '@/lib/phoneE164';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const agent = await resolveBuyerIntakeAgent();
    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Kanał wyszukiwania jest tymczasowo niedostępny.' },
        { status: 503 },
      );
    }

    const url = new URL(req.url);
    const phoneRaw = String(url.searchParams.get('phone') || '').trim();
    const emailRaw = String(url.searchParams.get('email') || '').trim();

    const phoneE164 = phoneRaw ? normalizePhoneE164(phoneRaw) : null;
    const email = emailRaw ? normalizeBuyerContactEmail(emailRaw) : null;

    const phoneValid = phoneRaw ? Boolean(phoneE164) : null;
    const emailValid = emailRaw ? Boolean(email) : null;

    if (phoneValid === false || emailValid === false) {
      return NextResponse.json({
        success: true,
        phoneValid,
        emailValid,
        phoneInCrm: false,
        emailInCrm: false,
        existingClient: null,
      });
    }

    if (!phoneE164 && !email) {
      return NextResponse.json({
        success: true,
        phoneValid: null,
        emailValid: null,
        phoneInCrm: false,
        emailInCrm: false,
        existingClient: null,
      });
    }

    const matches = await findDuplicateAgencyClients({
      agencyUserId: agent.userId,
      email,
      phone: phoneE164,
    });

    const top = matches[0] ?? null;

    return NextResponse.json({
      success: true,
      phoneValid,
      emailValid,
      phoneInCrm: Boolean(top?.matchedBy.phone),
      emailInCrm: Boolean(top?.matchedBy.email),
      existingClient: top
        ? {
            firstName: top.firstName,
            type: top.type,
            matchedBy: top.matchedBy,
          }
        : null,
    });
  } catch (error) {
    console.error('[BUYER INTAKE CONTACT CHECK]', error);
    return NextResponse.json({ success: false, error: 'Nie udało się sprawdzić danych.' }, { status: 500 });
  }
}

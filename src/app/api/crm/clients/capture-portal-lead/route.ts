import { NextResponse } from 'next/server';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import { capturePortalLead } from '@/lib/crm/capturePortalLead';

export async function POST(req: Request) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) {
    return NextResponse.json({ error: 'Dostęp tylko dla agencji i agentów.' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const result = await capturePortalLead({
    agencyUserId,
    paste: body.paste ? String(body.paste) : undefined,
    firstName: body.firstName ? String(body.firstName) : undefined,
    lastName: body.lastName ? String(body.lastName) : undefined,
    email: body.email != null ? String(body.email) : undefined,
    phone: body.phone != null ? String(body.phone) : undefined,
    message: body.message != null ? String(body.message) : undefined,
    offerId: body.offerId != null ? Number(body.offerId) : undefined,
    source: body.source ? String(body.source) : undefined,
    contactConsent: body.contactConsent === true,
    forceUseClientId: body.forceUseClientId != null ? Number(body.forceUseClientId) : null,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        code: 'code' in result ? result.code : undefined,
        matches: 'matches' in result ? result.matches : undefined,
        offerId: 'offerId' in result ? result.offerId : undefined,
        parsed: 'parsed' in result ? result.parsed : undefined,
      },
      { status: result.status },
    );
  }

  return NextResponse.json({ success: true, ...result });
}

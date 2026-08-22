import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import { ensureDeskSchema } from '@/lib/desk/ensureSchema';
import { findExistingAgencyClient } from '@/lib/desk/prospects';
import { dispatchDeskWorkflow } from '@/lib/desk/workflowEngine';
import { generatePortalToken } from '@/lib/agencyClientNotify';
import { ensureAgencyClientLinkedUser } from '@/lib/crm/linkedUser';

/**
 * Convert Open House guest or auction bidder (platform User) into AgencyClient + BUY DeskCase.
 */
export async function POST(req: Request) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) {
    return NextResponse.json({ error: 'Dostęp tylko dla agencji i agentów.' }, { status: 403 });
  }

  await ensureDeskSchema();
  const body = await req.json().catch(() => ({}));
  const source = String(body.source || 'open_house');
  const userId = Number(body.userId);
  const offerId = body.offerId != null ? Number(body.offerId) : null;
  const deskCaseId = body.deskCaseId != null ? Number(body.deskCaseId) : null;

  let firstName = String(body.firstName || '').trim();
  let lastName = String(body.lastName || '').trim();
  let email = body.email ? String(body.email).trim().toLowerCase() : null;
  let phone = body.phone ? String(body.phone).trim() : null;
  let name = String(body.name || '').trim();

  if (Number.isFinite(userId) && userId > 0) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, phone: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'Nie znaleziono użytkownika.' }, { status: 404 });
    }
    email = email || user.email || null;
    phone = phone || user.phone || null;
    name = name || user.name || '';
  }

  if ((!firstName || !lastName) && name) {
    const parts = name.split(/\s+/).filter(Boolean);
    firstName = firstName || parts[0] || 'Gość';
    lastName = lastName || parts.slice(1).join(' ') || 'OH';
  }
  if (!firstName) firstName = 'Gość';
  if (!lastName) lastName = source === 'auction' ? 'Licytant' : 'OH';

  const existing = await findExistingAgencyClient({ agencyUserId, email, phone });
  let client = existing;
  if (!client) {
    const linkedUserId =
      Number.isFinite(userId) && userId > 0
        ? userId
        : await ensureAgencyClientLinkedUser({
            email,
            phone,
            name: `${firstName} ${lastName}`.trim(),
          });
    client = await prisma.agencyClient.create({
      data: {
        agencyUserId,
        type: 'BUYER',
        firstName,
        lastName,
        email,
        phone,
        linkedUserId,
        portalToken: generatePortalToken(),
        notes: `Dodany z ${source}${offerId ? ` · oferta #${offerId}` : ''}`,
      },
    });
  }

  let buyCase = await prisma.deskCase.findFirst({
    where: { agencyUserId, clientId: client.id, kind: 'BUY' },
    orderBy: { updatedAt: 'desc' },
  });

  if (!buyCase) {
    buyCase = await prisma.deskCase.create({
      data: {
        agencyUserId,
        clientId: client.id,
        kind: 'BUY',
        pipelineStage: 'INQUIRY',
        source,
        linkedOfferId: Number.isFinite(offerId) ? offerId : null,
        title: `${client.firstName} ${client.lastName} · kupujący`,
        nextAction: 'Kwalifikacja kupującego',
        nextActionAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        temperature: 'WARM',
        health: 'HEALTHY',
      },
    });
    await dispatchDeskWorkflow({
      agencyUserId,
      caseId: buyCase.id,
      trigger: 'MANUAL_STAGE',
      payload: { stage: 'INQUIRY', nextAction: 'Kwalifikacja kupującego' },
    });
  }

  if (deskCaseId != null && Number.isFinite(deskCaseId) && deskCaseId > 0) {
    const sellCase = await prisma.deskCase.findFirst({
      where: { id: deskCaseId, agencyUserId, kind: 'SELL' },
      select: { id: true },
    });
    if (!sellCase) {
      return NextResponse.json({ error: 'Nie znaleziono sprawy SELL.' }, { status: 404 });
    }
    await prisma.agencyClientActivity.create({
      data: {
        clientId: client.id,
        agencyUserId,
        kind: 'DESK_NOTE',
        title: `Konwersja z ${source}`,
        body: `Powiązano ze sprawą sprzedaży #${deskCaseId}`,
        offerId: offerId != null && Number.isFinite(offerId) ? offerId : null,
        metadata: { fromDeskCaseId: deskCaseId, source },
      },
    });
  }

  return NextResponse.json({
    success: true,
    reusedClient: Boolean(existing),
    client,
    case: buyCase,
  });
}

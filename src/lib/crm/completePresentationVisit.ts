import { prisma } from '@/lib/prisma';
import { parsePesel } from '@/lib/pesel';
import { hashPesel, normalizePeselDigits } from '@/lib/crm/peselHash';
import { JOURNEY_ACTIVITY, resolvePresentation } from '@/lib/crm/clientJourney';
import {
  buildAttendanceClientEmailHtml,
  buildPresentationAttendanceHtml,
  formatMoneyPln,
} from '@/lib/crm/presentationAttendanceDocument';
import { sendTransactionalEmail } from '@/lib/email/transactional';
import { resumeIntelligenceForAgent } from '@/lib/crm/intelligenceCheckback';
import { refreshAgencyClientMatches } from '@/lib/agencyClientMatching';
import { resolvePublicAppOrigin } from '@/lib/offerShareLanding';

export type VisitDebrief = {
  outcome: 'interested' | 'maybe' | 'reject';
  priceHint?: string | null;
  remindDays?: number | null;
  liked?: string | null;
  disliked?: string | null;
  criteria?: {
    city?: string | null;
    district?: string | null;
    maxPrice?: number | null;
    minRooms?: number | null;
    maxRooms?: number | null;
  } | null;
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function documentIdFor(clientId: number, offerId: number, at: Date) {
  return `PO-${clientId}-${offerId}-${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}-${pad(at.getHours())}${pad(at.getMinutes())}`;
}

export async function completePresentationVisit(params: {
  agencyUserId: number;
  clientId: number;
  signatureDataUrl: string;
  pesel?: string | null;
  skipPesel?: boolean;
  offerId?: number | null;
  debrief: VisitDebrief;
  pdfBase64?: string | null;
  htmlOverride?: string | null;
}) {
  const signatureDataUrl = String(params.signatureDataUrl || '').trim();
  if (!signatureDataUrl.startsWith('data:image')) {
    return { ok: false as const, status: 400, error: 'Brak podpisu klienta.' };
  }
  if (!params.debrief?.outcome) {
    return { ok: false as const, status: 400, error: 'Wybierz wynik rozmowy po pokazie.' };
  }

  const client = await prisma.agencyClient.findFirst({
    where: { id: params.clientId, agencyUserId: params.agencyUserId, status: 'ACTIVE' },
    include: {
      activities: {
        where: {
          kind: {
            in: [
              JOURNEY_ACTIVITY.PRESENTATION,
              JOURNEY_ACTIVITY.PRESENTATION_CHANGE,
              JOURNEY_ACTIVITY.PRESENTATION_CONFIRMED,
              JOURNEY_ACTIVITY.PRESENTATION_HELD,
            ],
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!client) return { ok: false as const, status: 404, error: 'Nie znaleziono klienta.' };

  let peselDigits: string | null = client.pesel || null;
  if (params.pesel != null && String(params.pesel).trim()) {
    if (!parsePesel(String(params.pesel))) {
      return { ok: false as const, status: 400, error: 'Nieprawidłowy PESEL.' };
    }
    peselDigits = normalizePeselDigits(String(params.pesel));
    await prisma.agencyClient.update({
      where: { id: client.id },
      data: { pesel: peselDigits, peselHash: hashPesel(peselDigits) },
    });
  }

  const slot = resolvePresentation(client.activities);
  const offerId =
    Number(params.offerId || slot?.offerId || 0) ||
    null;
  if (!offerId) {
    return { ok: false as const, status: 400, error: 'Brak oferty powiązanej z prezentacją.' };
  }

  const offer = await prisma.offer.findFirst({
    where: { id: offerId },
    select: { id: true, title: true, street: true, city: true, district: true, price: true },
  });
  if (!offer) return { ok: false as const, status: 404, error: `Oferta #${offerId} nie istnieje.` };

  const agency = await prisma.user.findUnique({
    where: { id: params.agencyUserId },
    select: { name: true, companyName: true, phone: true },
  });

  const heldAt = new Date();
  const viewingAt = slot?.startsAt ? new Date(slot.startsAt) : heldAt;
  const viewingAtLabel = viewingAt.toLocaleString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const viewingDatePart = viewingAt.toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const viewingTimePart = viewingAt.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  const address =
    [offer.street, offer.district, offer.city].filter(Boolean).join(', ') || offer.city || `Oferta #${offer.id}`;
  const docId = documentIdFor(client.id, offer.id, heldAt);
  const origin = resolvePublicAppOrigin();
  const logoAbsoluteUrl = `${origin}/brand/estateos-logo-dark.jpg`;
  const agencyName = agency?.companyName || 'EstateOS';
  const agentName = agency?.name || 'Agent';

  const html =
    params.htmlOverride ||
    buildPresentationAttendanceHtml({
      documentId: docId,
      agencyName,
      agentName,
      agentPhone: agency?.phone || null,
      clientName: `${client.firstName} ${client.lastName}`.trim(),
      clientPhone: client.phone,
      clientEmail: client.email,
      clientPesel: peselDigits,
      offerId: offer.id,
      offerTitle: offer.title,
      offerAddress: address,
      offerPriceLabel: formatMoneyPln(offer.price != null ? Number(offer.price) : null),
      viewingAtLabel,
      viewingDatePart,
      viewingTimePart,
      signatureDataUrl,
      signedAtLabel: heldAt.toLocaleString('pl-PL'),
      logoAbsoluteUrl,
    });

  if (!slot?.heldAt) {
    await prisma.agencyClientActivity.create({
      data: {
        clientId: client.id,
        agencyUserId: params.agencyUserId,
        offerId: offer.id,
        kind: JOURNEY_ACTIVITY.PRESENTATION_HELD,
        title: `Prezentacja odbyta · #${offer.id}`,
        body: viewingAtLabel,
        metadata: {
          startsAt: slot?.startsAt || heldAt.toISOString(),
          proposedSlots: slot?.proposedSlots || [heldAt.toISOString()],
          heldAt: heldAt.toISOString(),
          offerId: offer.id,
          showingKind: slot?.showingKind || null,
          buyerClientId: slot?.buyerClientId || client.id,
          sellerClientId: slot?.sellerClientId || null,
          status: 'confirmed',
          attendanceSlip: {
            documentId: docId,
            signedAt: heldAt.toISOString(),
            hasPesel: Boolean(peselDigits),
            skipPesel: params.skipPesel === true && !peselDigits,
          },
        },
      },
    });
  }

  await prisma.agencyClientActivity.create({
    data: {
      clientId: client.id,
      agencyUserId: params.agencyUserId,
      offerId: offer.id,
      kind: 'PRESENTATION_DEBRIEF',
      title: `Po pokazie · ${params.debrief.outcome}`,
      body:
        params.debrief.outcome === 'interested'
          ? `Zainteresowany${params.debrief.priceHint ? ` · ${params.debrief.priceHint}` : ''}`
          : params.debrief.outcome === 'maybe'
            ? `Potrzebuje czasu${params.debrief.remindDays ? ` · ${params.debrief.remindDays} dni` : ''}`
            : `Szuka dalej${params.debrief.liked ? ` · OK: ${params.debrief.liked}` : ''}`,
      metadata: {
        ...params.debrief,
        offerId: offer.id,
        documentId: docId,
      },
    },
  });

  const openRows = await prisma.agencyClientActivity.findMany({
    where: {
      clientId: client.id,
      kind: { in: ['CLIENT_FEEDBACK', 'INTELLIGENCE_HANDOFF', 'EXTERNAL_PORTAL_LEAD'] },
      offerId: offer.id,
    },
    select: { id: true, metadata: true },
  });
  for (const row of openRows) {
    const meta =
      row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? { ...(row.metadata as Record<string, unknown>) }
        : {};
    if (meta.agentStatus === 'done') continue;
    await prisma.agencyClientActivity.update({
      where: { id: row.id },
      data: {
        metadata: { ...meta, agentStatus: 'done', agentHandledAt: heldAt.toISOString() },
      },
    });
  }

  if (params.debrief.outcome === 'reject' && params.debrief.criteria) {
    const c = params.debrief.criteria;
    const maxPrice =
      c.maxPrice ?? (offer.price != null ? Math.round(Number(offer.price) * 1.1) : null);
    const city = c.city || offer.city || null;
    const districts = c.district ? [c.district] : undefined;
    await prisma.agencyClientBuyerPreference.upsert({
      where: { clientId: client.id },
      create: {
        clientId: client.id,
        transactionType: 'SELL',
        propertyType: 'FLAT',
        city,
        districts,
        maxPrice,
        minRooms: c.minRooms ?? null,
        maxRooms: c.maxRooms ?? null,
        minMatchThreshold: 70,
      },
      update: {
        city,
        districts,
        maxPrice,
        minRooms: c.minRooms ?? undefined,
        maxRooms: c.maxRooms ?? undefined,
      },
    });
    await refreshAgencyClientMatches(client.id);
    try {
      const { notifyAgencyClientAboutOffers } = await import('@/lib/agencyClientNotify');
      const top = await prisma.agencyClientMatch.findMany({
        where: { clientId: client.id, offerId: { not: offer.id } },
        orderBy: { score: 'desc' },
        take: 5,
        select: { offerId: true },
      });
      if (top.length) {
        await notifyAgencyClientAboutOffers({
          clientId: client.id,
          offerIds: top.map((m) => m.offerId),
          agencyUserId: params.agencyUserId,
          channel: 'email',
          allowResend: true,
          customMessage: 'Propozycje dla Ciebie — po dzisiejszym oglądaniu.',
        });
      }
    } catch {
      /* best-effort */
    }
  }

  if (params.debrief.outcome === 'interested' && params.debrief.priceHint) {
    await prisma.agencyClient.update({
      where: { id: client.id },
      data: {
        notes: [client.notes, `Zainteresowanie #${offer.id}: ${params.debrief.priceHint}`]
          .filter(Boolean)
          .join('\n')
          .slice(0, 4000),
      },
    });
  }

  // Nota do sprzedającego (jeśli jest w CRM)
  const seller = await prisma.agencyClient.findFirst({
    where: {
      agencyUserId: params.agencyUserId,
      type: 'SELLER',
      status: 'ACTIVE',
      linkedOfferId: offer.id,
    },
    select: { id: true },
  });
  if (seller) {
    const interest =
      params.debrief.outcome === 'interested'
        ? 'tak'
        : params.debrief.outcome === 'maybe'
          ? 'czas'
          : 'nie';
    await prisma.agencyClientActivity.create({
      data: {
        clientId: seller.id,
        agencyUserId: params.agencyUserId,
        offerId: offer.id,
        kind: 'PRESENTATION_SELLER_NOTE',
        title: 'Pokaz kupującemu odbył się',
        body: `Zainteresowanie: ${interest}. Bez danych osobowych kupującego.`,
        metadata: { interest, offerId: offer.id, heldAt: heldAt.toISOString() },
      },
    });
  }

  await resumeIntelligenceForAgent({ clientId: client.id, agencyUserId: params.agencyUserId }).catch(() => {});
  await prisma.agencyClient.update({
    where: { id: client.id },
    data: { intelligenceLastSentAt: null },
  });

  let emailSent = false;
  let emailSkippedReason: string | null = null;
  if (!client.email) {
    emailSkippedReason = 'Brak e-maila na karcie klienta — uzupełnij i użyj „Wyślij ponownie”.';
  } else {
    const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
    if (params.pdfBase64) {
      const raw = String(params.pdfBase64).replace(/^data:application\/pdf;base64,/, '');
      attachments.push({
        filename: `Potwierdzenie-ogladania-${offer.id}-${heldAt.toISOString().slice(0, 10)}.pdf`,
        content: Buffer.from(raw, 'base64'),
        contentType: 'application/pdf',
      });
    } else {
      attachments.push({
        filename: `Potwierdzenie-ogladania-${offer.id}.html`,
        content: Buffer.from(html, 'utf8'),
        contentType: 'text/html; charset=utf-8',
      });
    }
    emailSent = await sendTransactionalEmail({
      to: client.email,
      subject: `Potwierdzenie oglądania — ${address} — ${viewingAtLabel}`,
      html: buildAttendanceClientEmailHtml({
        firstName: client.firstName,
        address,
        whenLabel: viewingAtLabel,
        agentName,
        agencyName,
        agentPhone: agency?.phone || null,
      }),
      attachments,
    });
    if (!emailSent) emailSkippedReason = 'Nie udało się wysłać maila (SMTP). Dokument zapisany.';
  }

  await prisma.agencyClientActivity.create({
    data: {
      clientId: client.id,
      agencyUserId: params.agencyUserId,
      offerId: offer.id,
      kind: 'PRESENTATION_ATTENDANCE_DOC',
      title: 'Potwierdzenie oglądania (PDF/HTML)',
      body: emailSent ? `Wysłano na ${client.email}` : emailSkippedReason || 'Zapisano lokalnie',
      metadata: {
        documentId: docId,
        emailSent,
        htmlStored: true,
        hasPdf: Boolean(params.pdfBase64),
      },
    },
  });

  return {
    ok: true as const,
    documentId: docId,
    html,
    emailSent,
    emailSkippedReason,
    offerId: offer.id,
    debrief: params.debrief,
    clientEmail: client.email,
    clientPhone: client.phone,
  };
}

export async function resendAttendanceEmail(params: {
  agencyUserId: number;
  clientId: number;
  html: string;
  pdfBase64?: string | null;
  documentId: string;
  address: string;
  whenLabel: string;
}) {
  const client = await prisma.agencyClient.findFirst({
    where: { id: params.clientId, agencyUserId: params.agencyUserId, status: 'ACTIVE' },
    select: { email: true, firstName: true },
  });
  if (!client?.email) {
    return { ok: false as const, status: 400, error: 'Brak e-maila na karcie klienta.' };
  }
  const agency = await prisma.user.findUnique({
    where: { id: params.agencyUserId },
    select: { name: true, companyName: true, phone: true },
  });
  const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
  if (params.pdfBase64) {
    const raw = String(params.pdfBase64).replace(/^data:application\/pdf;base64,/, '');
    attachments.push({
      filename: `Potwierdzenie-ogladania-${params.documentId}.pdf`,
      content: Buffer.from(raw, 'base64'),
      contentType: 'application/pdf',
    });
  } else {
    attachments.push({
      filename: `Potwierdzenie-ogladania-${params.documentId}.html`,
      content: Buffer.from(params.html, 'utf8'),
      contentType: 'text/html; charset=utf-8',
    });
  }
  const sent = await sendTransactionalEmail({
    to: client.email,
    subject: `Potwierdzenie oglądania — ${params.address} — ${params.whenLabel}`,
    html: buildAttendanceClientEmailHtml({
      firstName: client.firstName,
      address: params.address,
      whenLabel: params.whenLabel,
      agentName: agency?.name || 'Agent',
      agencyName: agency?.companyName || 'EstateOS',
      agentPhone: agency?.phone || null,
    }),
    attachments,
  });
  if (!sent) return { ok: false as const, status: 502, error: 'Nie udało się wysłać maila.' };
  return { ok: true as const };
}

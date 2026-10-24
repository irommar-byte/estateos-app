import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requireAgencyUserId } from '@/lib/agencyClientAuth';
import { prisma } from '@/lib/prisma';
import { buildPortalUrl } from '@/lib/agencyClientNotify';
import {
  listPortalCompanions,
  loadCompanionFeedback,
  mergePortalPermissions,
  parsePortalPermissions,
  revokePortalCompanion,
} from '@/lib/crm/portalAccess';
import { qrSvg } from '@/lib/qrSvg';
import { ensureClientInviteCode, inviteDeepLink, regenerateClientInviteCode } from '@/lib/crm/clientInviteCode';
import {
  SHOWING_FEEDBACK_TAGS,
  computeNetProceeds,
  loadListingStats,
  loadSellerBuyerOffers,
  loadShowingFeedbackSummary,
  parseSellerFinance,
} from '@/lib/crm/sellerPortal';
import { parseSearchPolygon } from '@/lib/geo/searchPolygon';
import { parseClientOfferFeedback } from '@/lib/crm/clientPortalFeedback';
import {
  addClientDocumentItem,
  deleteDocumentTemplate,
  documentsSummary,
  listDocumentTemplates,
  loadClientDocuments,
  removeClientDocumentItem,
  reviewClientDocument,
  saveDocumentTemplate,
  updateClientDocumentItem,
} from '@/lib/crm/clientDocuments';

export const dynamic = 'force-dynamic';

type RouteCtx = { params: Promise<{ id: string }> };

async function ownedClient(req: Request, ctx: RouteCtx) {
  const agencyUserId = await requireAgencyUserId(req);
  if (!agencyUserId) return { error: NextResponse.json({ error: 'Dostęp tylko dla agentów.' }, { status: 403 }) } as const;
  const { id } = await ctx.params;
  const clientId = Number(id);
  const client = await prisma.agencyClient.findFirst({
    where: { id: clientId, agencyUserId },
    select: {
      id: true,
      type: true,
      firstName: true,
      portalToken: true,
      portalPermissions: true,
      sellerFinance: true,
      linkedOfferId: true,
      linkedOffer: { select: { price: true } },
    },
  });
  if (!client) return { error: NextResponse.json({ error: 'Nie znaleziono klienta.' }, { status: 404 }) } as const;
  return { agencyUserId, client } as const;
}

/** Narzędzia panelu klienta widziane przez agenta. */
export async function GET(req: Request, ctx: RouteCtx) {
  const owned = await ownedClient(req, ctx);
  if ('error' in owned) return owned.error;
  const { client, agencyUserId } = owned;
  const companions = await listPortalCompanions(client.id);
  const matches = await prisma.agencyClientMatch.findMany({
    where: { clientId: client.id, notifiedAt: { not: null } },
    select: { id: true, clientFeedback: true, clientFavorite: true, offer: { select: { id: true, title: true } } },
    orderBy: { notifiedAt: 'desc' },
    take: 40,
  });
  const companionFeedback = await loadCompanionFeedback(client.id, matches.map((m) => m.id));
  const criteriaRequests = await prisma.agencyClientActivity.findMany({
    where: { clientId: client.id, kind: 'PORTAL_CRITERIA_REQUEST' },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, title: true, createdAt: true, metadata: true },
  });
  const inviteCode = await ensureClientInviteCode(client.id).catch(() => null);
  const finance = parseSellerFinance(client.sellerFinance);
  const listPrice = Number(client.linkedOffer?.price || 0);
  const documents = await loadClientDocuments(client.id, client.type).catch(() => []);
  return NextResponse.json({
    success: true,
    tools: {
      documents,
      documentsSummary: documentsSummary(documents),
      documentTemplates: await listDocumentTemplates(agencyUserId),
      permissions: parsePortalPermissions(client.portalPermissions),
      portalUrl: client.portalToken ? buildPortalUrl(client.portalToken) : null,
      appInvite: inviteCode
        ? { code: inviteCode, link: inviteDeepLink(inviteCode), qrSvg: qrSvg(inviteDeepLink(inviteCode)) }
        : null,
      companions: companions.map((c) => ({
        id: c.id,
        name: c.name,
        createdAt: c.createdAt.toISOString(),
        lastSeenAt: c.lastSeenAt?.toISOString() ?? null,
      })),
      ratings: matches
        .map((m) => {
          const own = parseClientOfferFeedback(m.clientFeedback);
          return {
            matchId: m.id,
            offerId: m.offer.id,
            title: m.offer.title,
            favorite: m.clientFavorite,
            client: own.sentiment,
            partners: (companionFeedback.get(m.id) || []).map((f) => ({ name: f.name, sentiment: f.sentiment, note: f.note })),
          };
        })
        .filter((row) => row.client || row.partners.length || row.favorite),
      criteriaRequests: criteriaRequests.map((row) => {
        const meta = (row.metadata || {}) as Record<string, unknown>;
        return {
          id: row.id,
          title: row.title,
          createdAt: row.createdAt.toISOString(),
          status: String(meta.status || 'pending'),
          polygon: parseSearchPolygon(meta.searchPolygon),
        };
      }),
      seller:
        client.type === 'SELLER'
          ? {
              stats: await loadListingStats(client.id, client.linkedOfferId),
              buyerOffers: await loadSellerBuyerOffers(client.id),
              showingFeedback: await loadShowingFeedbackSummary(client.id),
              feedbackTags: SHOWING_FEEDBACK_TAGS,
              finance,
              netAtListPrice: listPrice > 0 ? computeNetProceeds(listPrice, finance) : null,
            }
          : null,
    },
  });
}

export async function POST(req: Request, ctx: RouteCtx) {
  const owned = await ownedClient(req, ctx);
  if ('error' in owned) return owned.error;
  const { client, agencyUserId } = owned;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || '');
  const fail = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });

  if (action === 'set_permissions') {
    const next = mergePortalPermissions(client.portalPermissions, body.permissions);
    await prisma.agencyClient.update({ where: { id: client.id }, data: { portalPermissions: next } });
    return NextResponse.json({ success: true, permissions: next });
  }

  if (action === 'regenerate_invite') {
    const code = await regenerateClientInviteCode(client.id);
    return NextResponse.json({ success: true, appInvite: { code, link: inviteDeepLink(code) } });
  }

  if (action === 'revoke_companion') {
    await revokePortalCompanion(client.id, Number(body.companionId));
    return NextResponse.json({ success: true });
  }

  if (action === 'approve_criteria_request' || action === 'reject_criteria_request') {
    const row = await prisma.agencyClientActivity.findFirst({
      where: { id: Number(body.requestId), clientId: client.id, kind: 'PORTAL_CRITERIA_REQUEST' },
    });
    if (!row) return fail('Nie znaleziono prośby.', 404);
    const meta = (row.metadata || {}) as Record<string, unknown>;
    if (action === 'approve_criteria_request') {
      const polygon = parseSearchPolygon(meta.searchPolygon);
      await prisma.agencyClientBuyerPreference.update({
        where: { clientId: client.id },
        data: { searchPolygon: polygon ?? Prisma.JsonNull },
      });
      const { refreshAgencyClientMatches } = await import('@/lib/agencyClientMatching');
      await refreshAgencyClientMatches(client.id).catch(() => {});
    }
    await prisma.agencyClientActivity.update({
      where: { id: row.id },
      data: { metadata: { ...meta, status: action === 'approve_criteria_request' ? 'applied' : 'rejected' } },
    });
    return NextResponse.json({ success: true });
  }

  if (action === 'save_buyer_offer') {
    if (client.type !== 'SELLER') return fail('Oferty kupujących są tylko u sprzedającego.');
    const amount = Math.round(Number(body.amount));
    if (!Number.isFinite(amount) || amount <= 0) return fail('Podaj kwotę oferty.');
    const data = {
      buyerLabel: String(body.buyerLabel || 'Kupujący').trim().slice(0, 120) || 'Kupujący',
      amount,
      financing: String(body.financing || 'cash').slice(0, 32),
      deposit: body.deposit == null || body.deposit === '' ? null : Math.round(Number(body.deposit)),
      deedWeeks: body.deedWeeks == null || body.deedWeeks === '' ? null : Math.round(Number(body.deedWeeks)),
      handoverDays: body.handoverDays == null || body.handoverDays === '' ? null : Math.round(Number(body.handoverDays)),
      note: body.note ? String(body.note).slice(0, 2000) : null,
      recommendation: body.recommendation ? String(body.recommendation).slice(0, 2000) : null,
      recommendationKind: ['accept', 'counter', 'reject'].includes(String(body.recommendationKind))
        ? String(body.recommendationKind)
        : null,
      respondBy: body.respondBy ? new Date(String(body.respondBy)) : null,
      updatedAt: new Date(),
    };
    const id = Number(body.buyerOfferId || 0);
    const saved = id
      ? await prisma.sellerBuyerOffer.updateMany({ where: { id, clientId: client.id }, data }).then(() => ({ id }))
      : await prisma.sellerBuyerOffer.create({ data: { ...data, clientId: client.id, agencyUserId } });
    if (!id && body.notify === true) {
      const { deliverToClient } = await import('@/lib/crm/clientOutbox');
      await deliverToClient({
        agencyUserId,
        clientId: client.id,
        category: 'decision',
        source: 'seller_buyer_offer',
        approved: true,
        steps: [
          {
            kind: 'push',
            clientId: client.id,
            payload: {
              title: 'Nowa oferta kupującego',
              body: `${data.buyerLabel}: ${amount.toLocaleString('pl-PL')} zł — szczegóły i moja rekomendacja w panelu.`,
              tag: `buyer-offer-${client.id}`,
              url: client.portalToken ? buildPortalUrl(client.portalToken) : undefined,
            },
          },
        ],
      }).catch(() => null);
    }
    return NextResponse.json({ success: true, id: saved.id });
  }

  if (action === 'close_buyer_offer') {
    await prisma.sellerBuyerOffer.updateMany({
      where: { id: Number(body.buyerOfferId), clientId: client.id },
      data: { status: 'CLOSED', updatedAt: new Date() },
    });
    return NextResponse.json({ success: true });
  }

  if (action === 'add_showing_feedback') {
    if (client.type !== 'SELLER') return fail('Opinie z oglądań są tylko u sprzedającego.');
    const tags = Array.isArray(body.tags) ? body.tags.map((t) => String(t).slice(0, 40)).filter(Boolean).slice(0, 10) : [];
    if (!tags.length) return fail('Zaznacz co najmniej jedną uwagę.');
    await prisma.sellerShowingFeedback.create({
      data: {
        clientId: client.id,
        agencyUserId,
        tags,
        note: body.note ? String(body.note).slice(0, 500) : null,
        visitAt: body.visitAt ? new Date(String(body.visitAt)) : new Date(),
      },
    });
    return NextResponse.json({ success: true });
  }

  if (action === 'save_seller_finance') {
    const merged = { ...parseSellerFinance(client.sellerFinance) };
    const input = (body.finance && typeof body.finance === 'object' ? body.finance : {}) as Record<string, unknown>;
    for (const key of ['mortgageBalance', 'purchaseYear', 'purchasePrice', 'commissionPct', 'otherCosts'] as const) {
      if (key in input) {
        const n = Number(input[key]);
        merged[key] = input[key] === null || input[key] === '' ? null : Number.isFinite(n) && n >= 0 ? n : merged[key];
      }
    }
    if ('commissionVat' in input) merged.commissionVat = input.commissionVat !== false;
    await prisma.agencyClient.update({ where: { id: client.id }, data: { sellerFinance: merged } });
    return NextResponse.json({ success: true, finance: merged });
  }

  if (action === 'review_document') {
    const status = String(body.status || '');
    if (!['accepted', 'rejected', 'missing'].includes(status)) return fail('Wybierz status.');
    try {
      const doc = await reviewClientDocument({
        clientId: client.id,
        itemKey: String(body.itemKey || ''),
        status: status as 'accepted' | 'rejected' | 'missing',
        note: body.note ? String(body.note) : null,
      });
      if (status === 'rejected' && client.portalToken) {
        const { deliverToClient } = await import('@/lib/crm/clientOutbox');
        // Agent sam kliknął „Popraw” — to jest jego akceptacja wiadomości.
        await deliverToClient({
          agencyUserId,
          clientId: client.id,
          category: 'documents',
          source: 'document_review',
          approved: true,
          steps: [
            {
              kind: 'push',
              clientId: client.id,
              payload: {
                title: 'Dokument do poprawy',
                body: `${doc.label}${doc.note ? ` — ${doc.note}` : ''}`.slice(0, 180),
                tag: `doc-${client.id}-${doc.key}`,
                url: buildPortalUrl(client.portalToken),
              },
            },
          ],
        }).catch(() => null);
      }
      return NextResponse.json({ success: true, document: doc });
    } catch (e) {
      return fail(e instanceof Error ? e.message : 'Błąd');
    }
  }

  const documentsPayload = async () => {
    const documents = await loadClientDocuments(client.id, client.type);
    return { documents, documentsSummary: documentsSummary(documents), documentTemplates: await listDocumentTemplates(agencyUserId) };
  };

  if (action === 'add_document') {
    try {
      const label = String(body.label || '');
      const hint = body.hint ? String(body.hint) : null;
      const required = body.required !== false;
      const doc = await addClientDocumentItem({ clientId: client.id, label, hint, required });
      // „Zapisz na zawsze” — pole trafia też do szablonów agenta, do użycia u kolejnych klientów.
      if (body.saveAsTemplate === true) await saveDocumentTemplate({ agencyUserId, label, hint, required });
      return NextResponse.json({ success: true, document: doc, ...(await documentsPayload()) });
    } catch (e) {
      return fail(e instanceof Error ? e.message : 'Błąd');
    }
  }

  if (action === 'update_document') {
    try {
      const doc = await updateClientDocumentItem({
        clientId: client.id,
        itemKey: String(body.itemKey || ''),
        label: body.label === undefined ? undefined : String(body.label),
        hint: body.hint === undefined ? undefined : body.hint === null ? null : String(body.hint),
        required: body.required === undefined ? undefined : body.required !== false,
      });
      if (body.saveAsTemplate === true) {
        await saveDocumentTemplate({ agencyUserId, label: doc.label, hint: doc.hint, required: doc.required });
      }
      return NextResponse.json({ success: true, document: doc, ...(await documentsPayload()) });
    } catch (e) {
      return fail(e instanceof Error ? e.message : 'Błąd');
    }
  }

  if (action === 'remove_document') {
    await removeClientDocumentItem(client.id, String(body.itemKey || ''));
    return NextResponse.json({ success: true, ...(await documentsPayload()) });
  }

  if (action === 'save_document_template') {
    try {
      const template = await saveDocumentTemplate({
        agencyUserId,
        label: String(body.label || ''),
        hint: body.hint ? String(body.hint) : null,
        required: body.required !== false,
      });
      return NextResponse.json({ success: true, template, documentTemplates: await listDocumentTemplates(agencyUserId) });
    } catch (e) {
      return fail(e instanceof Error ? e.message : 'Błąd');
    }
  }

  if (action === 'delete_document_template') {
    await deleteDocumentTemplate(agencyUserId, Number(body.templateId));
    return NextResponse.json({ success: true, documentTemplates: await listDocumentTemplates(agencyUserId) });
  }

  return fail('Nieznana akcja.');
}

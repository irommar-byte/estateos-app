#!/usr/bin/env npx tsx
/**
 * Import one N-O URL, refresh matches, propose to buyer (portal, no email).
 * CLIENT_ID=91 URL=https://... npx tsx scripts/propose-imported-offer.ts
 */
import { prisma } from '../src/lib/prisma';
import { importOfferFromUrl, isSupportedImportOfferUrl } from '../src/lib/otodomImport';
import {
  createOfferFromOtodomDraft,
  findExistingImportedOffer,
  findExistingImportedOfferByPortalUrl,
} from '../src/lib/otodomImportCreate';
import { enrichOtodomImportDraft } from '../src/lib/portalImportEnrich';
import { activateOfferPublication } from '../src/lib/offerPublication';
import { refreshAgencyClientMatches } from '../src/lib/agencyClientMatching';
import { sendIntelligenceOffer } from '../src/lib/crm/clientIntelligenceRun';

const DEFAULT_URL =
  'https://warszawa.nieruchomosci-online.pl/mieszkanie,m2,z-kuchnia-z-oknem/25486668.html';

async function importListing(url: string, ownerUserId: number) {
  const existingByUrl = await findExistingImportedOfferByPortalUrl(url);
  if (existingByUrl) {
    return { offerId: existingByUrl.id, title: existingByUrl.title || url, reused: true };
  }
  if (!isSupportedImportOfferUrl(url)) throw new Error('Nieobsługiwany URL importu');

  const draft = await enrichOtodomImportDraft(await importOfferFromUrl(url));
  const existing = await findExistingImportedOffer(draft);
  if (existing) {
    return { offerId: existing.id, title: existing.title || draft.title, reused: true };
  }

  const created = await createOfferFromOtodomDraft(draft, ownerUserId, undefined, {
    maxImportImages: 8,
    skipAutoFloorPlanProbe: true,
    smartAddEnabled: true,
    smartAddAutoApply: true,
  });
  if (!created.ok) {
    if (created.existingOfferId) {
      return { offerId: created.existingOfferId, title: draft.title, reused: true };
    }
    throw new Error(created.message || 'Import nie powiódł się');
  }

  try {
    await activateOfferPublication({
      userId: ownerUserId,
      offerId: created.offerId,
      kind: 'PLUS_CREDIT',
      skipEntitlementConsume: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/PUBLICATION_ALREADY_ACTIVE/i.test(message)) throw error;
  }

  return { offerId: created.offerId, title: draft.title, reused: false };
}

async function main() {
  const clientId = Number(process.env.CLIENT_ID || 91);
  const url = String(process.env.URL || DEFAULT_URL).trim();
  const token = process.env.TOKEN?.trim();

  let resolvedClientId = clientId;
  if (token) {
    const byToken = await prisma.agencyClient.findFirst({
      where: { portalToken: token, status: 'ACTIVE' },
      select: { id: true, agencyUserId: true, firstName: true, lastName: true },
    });
    if (!byToken) throw new Error('Brak klienta dla tokenu');
    resolvedClientId = byToken.id;
  }

  const client = await prisma.agencyClient.findUnique({
    where: { id: resolvedClientId },
    select: { id: true, agencyUserId: true, firstName: true, lastName: true, intelligenceEnabled: true },
  });
  if (!client) throw new Error(`Brak klienta ${resolvedClientId}`);

  console.error(`Klient: ${client.firstName} ${client.lastName} (#${client.id})`);
  console.error(`Import: ${url}`);

  const imported = await importListing(url, client.agencyUserId);
  await refreshAgencyClientMatches(client.id);

  if (!client.intelligenceEnabled) {
    await prisma.agencyClient.update({
      where: { id: client.id },
      data: { intelligenceEnabled: true },
    });
  }

  const sent = await sendIntelligenceOffer({
    clientId: client.id,
    force: true,
    ignoreInterval: true,
    channel: 'manual',
  });

  const offer = await prisma.offer.findUnique({
    where: { id: imported.offerId },
    select: {
      id: true,
      title: true,
      price: true,
      area: true,
      district: true,
      city: true,
      hasBalcony: true,
      status: true,
    },
  });

  const match = sent.pick.offerId
    ? await prisma.agencyClientMatch.findUnique({
        where: {
          clientId_offerId: { clientId: client.id, offerId: sent.pick.offerId },
        },
        select: { id: true, score: true, notifiedAt: true, intelligenceSent: true },
      })
    : null;

  console.log(
    JSON.stringify(
      {
        ok: true,
        imported,
        offer,
        sent,
        match,
        portalUrl: `/klient/${token || '(token)'}`,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

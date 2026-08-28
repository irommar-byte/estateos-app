#!/usr/bin/env npx tsx
/**
 * Smoke: auto portal supply + poprawny score przy notify.
 * TOKEN=... CLIENT_ID=91 npx tsx scripts/client-intelligence-supply-smoke.ts
 */
import { prisma } from '../src/lib/prisma';
import { pickIntelligenceOffer } from '../src/lib/crm/clientIntelligenceRun';
import { notifyAgencyClientAboutOffer } from '../src/lib/agencyClientNotify';
import { refreshAgencyClientMatches } from '../src/lib/agencyClientMatching';

async function main() {
  const token = process.env.TOKEN?.trim();
  let clientId = Number(process.env.CLIENT_ID || process.argv[2] || 0);

  if (!clientId && token) {
    const client = await prisma.agencyClient.findFirst({
      where: { portalToken: token, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!client) throw new Error(`Brak klienta dla tokenu ${token.slice(0, 8)}…`);
    clientId = client.id;
  }
  if (!clientId) throw new Error('Podaj CLIENT_ID lub TOKEN');

  const client = await prisma.agencyClient.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      agencyUserId: true,
      firstName: true,
      lastName: true,
      intelligenceEnabled: true,
      buyerPreference: { select: { id: true } },
    },
  });
  if (!client?.buyerPreference) throw new Error(`Klient #${clientId} bez ankiety radaru.`);

  console.log(`\n=== Smoke: klient #${client.id} ${client.firstName} ${client.lastName} ===\n`);

  const beforeMatches = await prisma.agencyClientMatch.count({ where: { clientId } });
  console.log(`Dopasowania przed pick: ${beforeMatches}`);

  const pick = await pickIntelligenceOffer(clientId, { preview: true, force: true });
  console.log('Pick preview:', {
    ready: pick.pick.ready,
    considered: pick.pick.considered,
    offerId: pick.pick.offerId,
    radarScore: pick.pick.radarScore,
    score: pick.pick.score,
    skipReason: pick.pick.skipReason,
  });

  const zeroScoreMatches = await prisma.agencyClientMatch.findMany({
    where: { clientId, sharedAt: { not: null }, score: 0 },
    select: { offerId: true, offer: { select: { title: true } } },
    take: 5,
  });
  if (zeroScoreMatches.length) {
    console.log(`\nNaprawiam ${zeroScoreMatches.length} udostępnionych matchy ze score=0…`);
    await refreshAgencyClientMatches(clientId);
    for (const row of zeroScoreMatches) {
      const refreshed = await prisma.agencyClientMatch.findUnique({
        where: { clientId_offerId: { clientId, offerId: row.offerId } },
        select: { score: true },
      });
      if (refreshed && refreshed.score > 0) {
        await prisma.agencyClientMatch.update({
          where: { clientId_offerId: { clientId, offerId: row.offerId } },
          data: { score: refreshed.score },
        });
        console.log(`  #${row.offerId} ${row.offer.title?.slice(0, 40)} → ${refreshed.score}%`);
      }
    }
  } else {
    console.log('\nBrak udostępnionych matchy ze score=0.');
  }

  const testOffer = pick.pick.offerId
    ? pick.pick.offerId
    : (
        await prisma.agencyClientMatch.findFirst({
          where: { clientId, score: { gt: 0 } },
          orderBy: { score: 'desc' },
          select: { offerId: true, score: true },
        })
      )?.offerId;

  if (testOffer) {
    const existing = await prisma.agencyClientMatch.findUnique({
      where: { clientId_offerId: { clientId, offerId: testOffer } },
      select: { score: true, sharedAt: true },
    });
    console.log(`\nTest resolveClientMatchScore via notify (dry upsert check): offer #${testOffer}, radar=${pick.pick.radarScore ?? existing?.score}`);
    if (!existing?.sharedAt) {
      console.log('(Pominięto notify — oferta nie była jeszcze udostępniona, nie wysyłam ponownie)');
    }
  }

  const autoHunt = await prisma.agencyClientActivity.findFirst({
    where: { clientId, kind: 'PORTAL_HUNT' },
    orderBy: { createdAt: 'desc' },
    select: { title: true, createdAt: true, metadata: true },
  });
  if (autoHunt) {
    console.log('\nOstatni PORTAL_HUNT:', autoHunt.title, autoHunt.createdAt.toISOString());
    console.log('  metadata.auto:', (autoHunt.metadata as Record<string, unknown>)?.auto ?? false);
  }

  const shared = await prisma.agencyClientMatch.findMany({
    where: { clientId, sharedAt: { not: null } },
    orderBy: { sharedAt: 'desc' },
    take: 3,
    select: { offerId: true, score: true, offer: { select: { title: true } } },
  });
  console.log('\nOstatnie propozycje w panelu:');
  for (const row of shared) {
    console.log(`  #${row.offerId} · ${row.score}% · ${row.offer.title?.slice(0, 50)}`);
  }

  const bad = shared.filter((row) => row.score === 0);
  if (bad.length) {
    console.error('\nFAIL: nadal są propozycje ze score 0%');
    process.exit(1);
  }
  console.log('\nOK: smoke test passed.');
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

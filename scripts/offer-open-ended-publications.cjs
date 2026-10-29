/**
 * Publikacje bezterminowe (bez 30 dni) — idempotentne, uruchamiane przy każdym wdrożeniu.
 * 1) Aktywne sesje publikacji dostają datę „bez końca”.
 * 2) Oferty ze statusem ACTIVE, których ostatnia sesja wygasła po 30 dniach, wracają na rynek za darmo.
 * 3) Oferty ACTIVE bez żadnej sesji (sprzed systemu publikacji) dostają sesję bezterminową.
 * 4) Oferty na rynku nie mają daty wygaśnięcia (Offer.expiresAt = NULL).
 */
const { PrismaClient } = require('@prisma/client');

const OPEN_END = '2099-12-31 23:59:59.000';
const prisma = new PrismaClient();

async function main() {
  const extended = await prisma.$executeRawUnsafe(
    `UPDATE OfferPublication SET endsAt = ? WHERE status = 'ACTIVE' AND endsAt < ?`,
    OPEN_END,
    OPEN_END,
  );

  const restored = await prisma.$executeRawUnsafe(
    `
      UPDATE OfferPublication p
      JOIN (SELECT offerId, MAX(id) AS lastId FROM OfferPublication GROUP BY offerId) l ON l.lastId = p.id
      JOIN \`Offer\` o ON o.id = p.offerId
      SET p.status = 'ACTIVE', p.endsAt = ?, p.endedAt = NULL, p.endReason = NULL
      WHERE o.status = 'ACTIVE' AND p.status = 'ENDED' AND (p.endReason = 'EXPIRED' OR p.endReason IS NULL)
    `,
    OPEN_END,
  );

  const created = await prisma.$executeRawUnsafe(
    `
      INSERT INTO OfferPublication (offerId, userId, kind, status, startedAt, endsAt)
      SELECT o.id, o.userId, 'PLUS_CREDIT', 'ACTIVE', NOW(3), ?
      FROM \`Offer\` o
      WHERE o.status = 'ACTIVE'
        AND NOT EXISTS (SELECT 1 FROM OfferPublication p WHERE p.offerId = o.id)
    `,
    OPEN_END,
  );

  const cleared = await prisma.$executeRawUnsafe(
    `
      UPDATE \`Offer\` o
      SET o.expiresAt = NULL
      WHERE o.status = 'ACTIVE'
        AND o.expiresAt IS NOT NULL
        AND EXISTS (SELECT 1 FROM OfferPublication p WHERE p.offerId = o.id AND p.status = 'ACTIVE')
    `,
  );

  const inconsistent = await prisma.$queryRawUnsafe(
    `
      SELECT COUNT(*) AS total FROM \`Offer\` o
      WHERE o.status = 'ACTIVE'
        AND NOT EXISTS (SELECT 1 FROM OfferPublication p WHERE p.offerId = o.id AND p.status = 'ACTIVE')
    `,
  );

  console.log(
    JSON.stringify({
      ok: true,
      step: 'offer-open-ended-publications',
      extended,
      restored,
      created,
      cleared,
      activeWithoutPublication: Number(inconsistent[0]?.total ?? 0),
    }),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

/**
 * Porządek importów, które zniknęły z portalu źródłowego (idempotentny, uruchamiany przy wdrożeniu):
 * 1) bez numeru właściciela → archiwum (tylko admin), publikacja zamknięta;
 * 2) z numerem → schodzą z publicznego rynku (SOURCE_GONE), zostają aktywne w CRM agenta;
 * 3) „wiszące” aktywne publikacje ofert już zarchiwizowanych / sprzedanych → zamknięte.
 */
import { prisma } from '../src/lib/prisma';
import { extractOwnerContact } from '../src/lib/crm/ownerContact';
import { endOfferPublication, hideImportedOfferFromMarket } from '../src/lib/offerPublication';

type Row = { id: number; userId: number; userNote: string | null; importSnapshotJson: string | null; importExternalUrl: string | null };

async function main() {
  const rows = (await prisma.$queryRawUnsafe(`
    SELECT o.id, n.userId, n.userNote, n.importSnapshotJson, n.importExternalUrl
    FROM \`Offer\` o
    JOIN OfferPrivateNote n ON n.id = (SELECT MAX(id) FROM OfferPrivateNote x WHERE x.offerId = o.id)
    WHERE o.status = 'ACTIVE'
      AND (n.importSource IS NOT NULL OR n.importExternalUrl IS NOT NULL OR n.importSnapshotJson IS NOT NULL)
      AND n.sourceIsActive = 0
  `)) as Row[];

  let archived = 0;
  let hidden = 0;
  for (const r of rows) {
    const id = Number(r.id);
    if (extractOwnerContact(r)?.phone) {
      if (Number(await hideImportedOfferFromMarket(id)) > 0) hidden += 1;
      continue;
    }
    await endOfferPublication({ offerId: id, endReason: 'SOURCE_GONE', offerStatus: 'ARCHIVED' });
    await prisma.$executeRawUnsafe(
      `UPDATE OfferPrivateNote SET sourceArchivedAt = COALESCE(sourceArchivedAt, NOW(3)) WHERE offerId = ?`,
      id,
    );
    archived += 1;
  }

  const zombies = await prisma.$executeRawUnsafe(`
    UPDATE OfferPublication p JOIN \`Offer\` o ON o.id = p.offerId
    SET p.status = 'ENDED', p.endedAt = NOW(3), p.endReason = COALESCE(p.endReason, IF(o.status = 'SOLD', 'SOLD', 'ADMIN'))
    WHERE p.status = 'ACTIVE' AND o.status IN ('ARCHIVED', 'SOLD', 'REJECTED')
  `);

  console.log(JSON.stringify({ ok: true, step: 'offer-source-gone-cleanup', checked: rows.length, archived, hiddenCrmOnly: hidden, zombiePublicationsClosed: zombies }));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());

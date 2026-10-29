import { prisma } from '@/lib/prisma';
import { verifyPortalListingActive } from '@/lib/keiAmerPortalVerify';
import { extractOwnerContact } from '@/lib/crm/ownerContact';
import { lookupKeiOwnerPhone } from '@/lib/crm/ownerContactLookup';
import { getOfferPrivateNote } from '@/lib/offerPrivateNotes';
import { endOfferPublication, hideImportedOfferFromMarket, restoreImportedOfferToMarket } from '@/lib/offerPublication';

/**
 * Cykl życia ofert z importu KEI: raz na dobę sprawdzamy, czy ogłoszenie źródłowe nadal wisi.
 * Archiwizujemy dopiero po dwóch pewnych potwierdzeniach (404/410 albo komunikat portalu)
 * w odstępie co najmniej 20 godzin — błąd sieci czy blokada antybotowa niczego nie zmienia.
 * Dotyczy wyłącznie ofert zaimportowanych z KEI (nie własnych importów właścicieli).
 */
const RECHECK_HOURS = 20;
const ARCHIVE_AFTER_STREAK = 2;

type Candidate = { offerId: number; userId: number; url: string; streak: number };

/** Ogłoszenie właśnie zniknęło z portalu, a nie mamy numeru właściciela → pytamy KEI, póki jeszcze go trzyma. */
async function secureOwnerPhone(offerId: number, userId: number): Promise<boolean> {
  const contact = extractOwnerContact(await getOfferPrivateNote(offerId, userId).catch(() => null));
  if (contact?.phone) return false;
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    select: { id: true, userId: true, propertyType: true, transactionType: true },
  });
  if (!offer) return false;
  return Boolean(await lookupKeiOwnerPhone(offer, 15_000).catch(() => null));
}

export async function runImportSourceLifecycle(options?: { limit?: number; dryRun?: boolean }) {
  const limit = Math.min(500, Math.max(1, options?.limit ?? 150));
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT opn.offerId, opn.userId, opn.importExternalUrl AS url, opn.sourceInactiveStreak AS streak
     FROM OfferPrivateNote opn
     JOIN \`Offer\` o ON o.id = opn.offerId
     JOIN KeiAmerListingState kls ON kls.importedOfferId = opn.offerId
     WHERE o.status IN ('ACTIVE', 'PENDING')
       AND opn.importExternalUrl IS NOT NULL AND TRIM(opn.importExternalUrl) <> ''
       AND opn.sourceArchivedAt IS NULL
       AND (opn.sourceLastCheckAt IS NULL OR opn.sourceLastCheckAt < DATE_SUB(NOW(3), INTERVAL ${RECHECK_HOURS} HOUR))
     ORDER BY opn.sourceLastCheckAt IS NULL DESC, opn.sourceLastCheckAt ASC
     LIMIT ?`,
    limit,
  )) as Array<{ offerId: number; userId: number; url: string; streak: number | null }>;

  const candidates: Candidate[] = rows.map((row) => ({
    offerId: Number(row.offerId),
    userId: Number(row.userId),
    url: String(row.url),
    streak: Number(row.streak || 0),
  }));

  const summary = { checked: 0, active: 0, inactive: 0, unknown: 0, archived: 0, archivedOfferIds: [] as number[], phonesSecured: 0, hidden: 0, restored: 0 };
  let phoneLookups = 0;
  let cursor = 0;
  const worker = async () => {
    while (cursor < candidates.length) {
      const item = candidates[cursor++];
      const verdict = await verifyPortalListingActive(item.url);
      summary.checked += 1;
      if (verdict.active === null) {
        summary.unknown += 1;
        if (!options?.dryRun) {
          await prisma.$executeRawUnsafe(
            `UPDATE OfferPrivateNote SET sourceLastCheckAt = NOW(3), sourceLastHttpStatus = ?, sourceLastError = ?
             WHERE offerId = ? AND userId = ?`,
            verdict.httpStatus,
            (verdict.reason || '').slice(0, 500),
            item.offerId,
            item.userId,
          );
        }
        continue;
      }
      const streak = verdict.active ? 0 : item.streak + 1;
      if (verdict.active) summary.active += 1;
      else summary.inactive += 1;
      if (options?.dryRun) continue;
      await prisma.$executeRawUnsafe(
        `UPDATE OfferPrivateNote
         SET sourceIsActive = ?, sourceLastCheckAt = NOW(3), sourceLastHttpStatus = ?, sourceLastError = ?,
             sourceInactiveStreak = ?
         WHERE offerId = ? AND userId = ?`,
        verdict.active ? 1 : 0,
        verdict.httpStatus,
        verdict.active ? null : (verdict.reason || '').slice(0, 500),
        streak,
        item.offerId,
        item.userId,
      );
      if (!verdict.active && streak === 1 && phoneLookups < 20) {
        phoneLookups += 1;
        if (await secureOwnerPhone(item.offerId, item.userId)) summary.phonesSecured += 1;
      }
      if (verdict.active) {
        // Ogłoszenie wróciło na portal — wraca też na publiczny rynek.
        if (Number(await restoreImportedOfferToMarket(item.offerId)) > 0) summary.restored += 1;
      }
      if (!verdict.active && streak >= ARCHIVE_AFTER_STREAK) {
        // Z numerem właściciela: znika z rynku publicznego, zostaje w CRM agenta (dalej sprawdzamy źródło).
        const contact = extractOwnerContact(await getOfferPrivateNote(item.offerId, item.userId).catch(() => null));
        if (contact?.phone) {
          if (Number(await hideImportedOfferFromMarket(item.offerId)) > 0) summary.hidden += 1;
          continue;
        }
        // Bez numeru: archiwum (widzi je tylko admin), razem z zamknięciem publikacji.
        const current = await prisma.offer.findUnique({ where: { id: item.offerId }, select: { status: true } });
        const updated = { count: 0 };
        if (current && ['ACTIVE', 'PENDING'].includes(String(current.status))) {
          await endOfferPublication({ offerId: item.offerId, endReason: 'SOURCE_GONE', offerStatus: 'ARCHIVED' });
          updated.count = 1;
        }
        if (updated.count > 0) {
          await prisma.$executeRawUnsafe(
            `UPDATE OfferPrivateNote SET sourceArchivedAt = NOW(3) WHERE offerId = ? AND userId = ?`,
            item.offerId,
            item.userId,
          );
          summary.archived += 1;
          summary.archivedOfferIds.push(item.offerId);
        }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, candidates.length) }, () => worker()));
  return summary;
}

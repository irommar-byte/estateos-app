import { prisma } from '@/lib/prisma';
import { normalizeImportPortalUrl } from '@/lib/otodomImport';
import { ensureOfferPrivateNoteTable } from '@/lib/offerPrivateNotes';

function stripPortalUrl(url: string): string {
  try {
    const parsed = new URL(String(url || '').trim());
    parsed.hash = '';
    parsed.search = '';
    let path = parsed.pathname.replace(/\/+$/, '');
    if (path && !path.endsWith('/')) path += '/';
    parsed.pathname = path || '/';
    return parsed.toString();
  } catch {
    return String(url || '').trim();
  }
}

let lockTableReady: Promise<void> | null = null;

export async function ensureImportExternalLockTable(): Promise<void> {
  if (!lockTableReady) {
    lockTableReady = prisma
      .$executeRawUnsafe(
        `
      CREATE TABLE IF NOT EXISTS ImportExternalLock (
        source VARCHAR(32) NOT NULL,
        externalId VARCHAR(64) NOT NULL,
        offerId INT NOT NULL DEFAULT 0,
        createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (source, externalId),
        KEY ImportExternalLock_offerId_idx (offerId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `,
      )
      .then(() => undefined)
      .catch((error) => {
        lockTableReady = null;
        throw error;
      });
  }
  await lockTableReady;
  await prisma.$executeRawUnsafe(
    `INSERT IGNORE INTO ImportExternalLock (source, externalId, offerId)
     SELECT importSource, importExternalId, MIN(offerId)
     FROM OfferPrivateNote
     WHERE importSource IS NOT NULL AND TRIM(importSource) <> ''
       AND importExternalId IS NOT NULL AND TRIM(importExternalId) <> ''
     GROUP BY importSource, importExternalId`,
  ).catch(() => undefined);
}

export function importUrlLookupCandidates(portalUrl: string): string[] {
  const raw = String(portalUrl || '').trim();
  if (!raw) return [];
  const variants = new Set<string>([raw]);
  try {
    variants.add(normalizeImportPortalUrl(raw));
  } catch {
    /* keep raw */
  }
  try {
    variants.add(stripPortalUrl(raw));
  } catch {
    /* keep raw */
  }

  for (const current of [...variants]) {
    try {
      const url = new URL(current);
      url.hash = '';
      const hosts = [url.hostname];
      const bare = url.hostname.replace(/^www\./i, '');
      hosts.push(bare, `www.${bare}`);
      const protocols = ['https:', 'http:'];
      for (const host of hosts) {
        for (const protocol of protocols) {
          const copy = new URL(url.toString());
          copy.hostname = host;
          copy.protocol = protocol;
          copy.search = '';
          const trimmedPath = copy.pathname.replace(/\/+$/, '') || '';
          copy.pathname = trimmedPath;
          variants.add(copy.toString());
          copy.pathname = trimmedPath ? `${trimmedPath}/` : '/';
          variants.add(copy.toString());
        }
      }
    } catch {
      variants.add(current.replace(/\/+$/, ''));
      variants.add(`${current.replace(/\/+$/, '')}/`);
    }
  }

  return [...variants].filter(Boolean);
}

export async function findOfferByImportExternalId(
  source: string,
  externalId: string | number | null | undefined,
): Promise<{ id: number; title: string | null; status: string } | null> {
  const src = String(source || '').trim().toUpperCase();
  const id = String(externalId || '').trim();
  if (!src || !id) return null;
  await ensureOfferPrivateNoteTable();
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT offerId FROM OfferPrivateNote
     WHERE importSource = ? AND importExternalId = ?
     ORDER BY offerId ASC
     LIMIT 1`,
    src,
    id,
  )) as Array<{ offerId: number }>;
  const offerId = Number(rows[0]?.offerId);
  if (!Number.isFinite(offerId) || offerId <= 0) return null;
  return prisma.offer.findUnique({
    where: { id: offerId },
    select: { id: true, title: true, status: true },
  });
}

export async function findOfferByImportFingerprint(input: {
  city?: string | null;
  district?: string | null;
  street?: string | null;
  price?: number | null;
  area?: number | null;
  transactionType?: string | null;
}): Promise<{ id: number; title: string | null; status: string } | null> {
  const city = String(input.city || '').trim();
  const district = String(input.district || '').trim();
  const street = String(input.street || '').trim();
  const price = Number(input.price);
  const area = Number(input.area);
  const transaction = String(input.transactionType || '').trim().toUpperCase();
  if (!city || !street || !Number.isFinite(price) || price <= 0 || !Number.isFinite(area) || area <= 0) {
    return null;
  }

  const rows = (await prisma.$queryRawUnsafe(
    `SELECT id, title, status FROM \`Offer\`
     WHERE status IN ('ACTIVE', 'PENDING')
       AND city = ?
       AND district = ?
       AND street = ?
       AND ABS(price - ?) < 1
       AND ABS(area - ?) < 0.51
       AND UPPER(COALESCE(transactionType, '')) = ?
     ORDER BY id ASC
     LIMIT 1`,
    city,
    district,
    street,
    price,
    area,
    transaction || 'SALE',
  )) as Array<{ id: number; title: string | null; status: string }>;

  return rows[0] ? { id: Number(rows[0].id), title: rows[0].title, status: rows[0].status } : null;
}

/** Atomically claims a portal listing so two import workers cannot create it twice. */
export async function claimImportExternalKey(
  source: string,
  externalId: string | number,
): Promise<{ claimed: true } | { claimed: false; offerId: number | null }> {
  await ensureImportExternalLockTable();
  const src = String(source || '').trim().toUpperCase();
  const id = String(externalId || '').trim();
  if (!src || !id) return { claimed: true };

  await prisma.$executeRawUnsafe(
    `DELETE FROM ImportExternalLock
     WHERE source = ? AND externalId = ? AND offerId = 0
       AND createdAt < DATE_SUB(NOW(3), INTERVAL 10 MINUTE)`,
    src,
    id,
  );

  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO ImportExternalLock (source, externalId, offerId) VALUES (?, ?, 0)`,
      src,
      id,
    );
    return { claimed: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/Duplicate|UNIQUE/i.test(message)) throw error;
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT offerId FROM ImportExternalLock WHERE source = ? AND externalId = ? LIMIT 1`,
      src,
      id,
    )) as Array<{ offerId: number }>;
    const offerId = Number(rows[0]?.offerId);
    return { claimed: false, offerId: Number.isFinite(offerId) && offerId > 0 ? offerId : null };
  }
}

export async function bindImportExternalKey(
  source: string,
  externalId: string | number,
  offerId: number,
): Promise<void> {
  await ensureImportExternalLockTable();
  const src = String(source || '').trim().toUpperCase();
  const id = String(externalId || '').trim();
  if (!src || !id || !Number.isFinite(offerId) || offerId <= 0) return;
  await prisma.$executeRawUnsafe(
    `INSERT INTO ImportExternalLock (source, externalId, offerId)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE offerId = VALUES(offerId)`,
    src,
    id,
    offerId,
  );
}

export async function releaseImportExternalClaim(source: string, externalId: string | number): Promise<void> {
  const src = String(source || '').trim().toUpperCase();
  const id = String(externalId || '').trim();
  if (!src || !id) return;
  await prisma.$executeRawUnsafe(
    `DELETE FROM ImportExternalLock WHERE source = ? AND externalId = ? AND offerId = 0`,
    src,
    id,
  ).catch(() => undefined);
}

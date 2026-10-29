import { prisma } from '@/lib/prisma';
import { photoRoomKey, type OfferPhotoRoom } from '@/lib/offerPhotoRoomKey';

export { photoRoomKey, type OfferPhotoRoom };

/**
 * Zdjęcie ↔ pomieszczenie (Salon, Łazienka…). Osobna tabela, żeby nie ruszać rekordu oferty:
 * strona łączy rzut ze zdjęciami w obie strony, a aplikacja przypisuje przy dodawaniu i edycji.
 */

let ensured: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  ensured ||= prisma
    .$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS \`OfferPhotoRoom\` (
        \`offerId\` INT NOT NULL,
        \`imagePath\` VARCHAR(500) NOT NULL,
        \`room\` VARCHAR(80) NOT NULL,
        \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`offerId\`, \`imagePath\`)
      ) DEFAULT CHARSET=utf8mb4`,
    )
    .then(() => undefined)
    .catch((err) => {
      ensured = null;
      throw err;
    });
  return ensured;
}

export function cleanRoomLabel(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

export async function loadOfferPhotoRooms(offerId: number): Promise<OfferPhotoRoom[]> {
  if (!Number.isFinite(offerId) || offerId <= 0) return [];
  try {
    await ensureTable();
    const rows = (await prisma.$queryRawUnsafe(
      'SELECT `imagePath`, `room` FROM `OfferPhotoRoom` WHERE `offerId` = ?',
      offerId,
    )) as Array<{ imagePath: string; room: string }>;
    return rows.map((row) => ({ url: row.imagePath, room: row.room }));
  } catch {
    return [];
  }
}

export async function setOfferPhotoRoom(offerId: number, url: string, room: string | null): Promise<void> {
  const key = photoRoomKey(url);
  if (!key) return;
  await ensureTable();
  const label = cleanRoomLabel(room);
  if (!label) {
    await prisma.$executeRawUnsafe('DELETE FROM `OfferPhotoRoom` WHERE `offerId` = ? AND `imagePath` = ?', offerId, key);
    return;
  }
  await prisma.$executeRawUnsafe(
    'INSERT INTO `OfferPhotoRoom` (`offerId`, `imagePath`, `room`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `room` = VALUES(`room`), `updatedAt` = CURRENT_TIMESTAMP(3)',
    offerId,
    key,
    label,
  );
}

/** Zapis całości z edycji: przypisania spoza listy są usuwane. */
export async function replaceOfferPhotoRooms(offerId: number, items: Array<{ url: string; room: string | null }>): Promise<OfferPhotoRoom[]> {
  await ensureTable();
  const clean = items
    .map((item) => ({ key: photoRoomKey(item.url), room: cleanRoomLabel(item.room) }))
    .filter((item) => item.key && item.room);
  await prisma.$executeRawUnsafe('DELETE FROM `OfferPhotoRoom` WHERE `offerId` = ?', offerId);
  for (const item of clean.slice(0, 200)) {
    await prisma.$executeRawUnsafe(
      'INSERT INTO `OfferPhotoRoom` (`offerId`, `imagePath`, `room`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `room` = VALUES(`room`)',
      offerId,
      item.key,
      item.room,
    );
  }
  return clean.map((item) => ({ url: item.key, room: item.room }));
}

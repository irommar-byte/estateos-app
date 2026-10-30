import { prisma } from '@/lib/prisma';
import { loadOfferPhotoRooms, photoRoomKey } from '@/lib/offerPhotoRooms';

/**
 * Zainteresowanie ofertą: które zdjęcia i pomieszczenia klienci oglądają i jak długo.
 * Liczniki zagregowane (bez danych osobowych): oferta × (zdjęcie | pokój) → wyświetlenia + czas.
 */
export type EngagementEvent = { kind: 'photo' | 'room'; key: string; ms: number };

let ensured: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  ensured ||= prisma
    .$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS \`OfferEngagement\` (
        \`offerId\` INT NOT NULL,
        \`kind\` VARCHAR(12) NOT NULL,
        \`itemKey\` VARCHAR(500) NOT NULL,
        \`views\` INT NOT NULL DEFAULT 0,
        \`dwellMs\` BIGINT NOT NULL DEFAULT 0,
        \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`offerId\`, \`kind\`, \`itemKey\`)
      ) DEFAULT CHARSET=utf8mb4`,
    )
    .then(() => undefined)
    .catch((err) => {
      ensured = null;
      throw err;
    });
  return ensured;
}

export async function recordEngagement(offerId: number, events: EngagementEvent[]): Promise<void> {
  if (!Number.isFinite(offerId) || offerId <= 0 || !events.length) return;
  await ensureTable();
  for (const event of events.slice(0, 60)) {
    const kind = event.kind === 'room' ? 'room' : 'photo';
    const key = kind === 'photo' ? photoRoomKey(event.key) : String(event.key || '').trim().slice(0, 80);
    if (!key) continue;
    // Krótkie mignięcia (<0,6 s) to przewijanie, nie oglądanie; dłużej niż 2 min — karta zostawiona w tle.
    const ms = Math.max(0, Math.min(120_000, Math.round(Number(event.ms) || 0)));
    if (kind === 'photo' && ms < 600) continue;
    await prisma.$executeRawUnsafe(
      'INSERT INTO `OfferEngagement` (`offerId`, `kind`, `itemKey`, `views`, `dwellMs`) VALUES (?, ?, ?, 1, ?) ON DUPLICATE KEY UPDATE `views` = `views` + 1, `dwellMs` = `dwellMs` + VALUES(`dwellMs`), `updatedAt` = CURRENT_TIMESTAMP(3)',
      offerId,
      kind,
      key,
      ms,
    );
  }
}

export type EngagementSummary = {
  rooms: Array<{ room: string; views: number; dwellMs: number; share: number }>;
  photos: Array<{ url: string; room: string | null; views: number; dwellMs: number }>;
  totalDwellMs: number;
  totalViews: number;
};

/** Podsumowanie dla agenta i sprzedającego: pokoje (zdjęcia + klik na planie) i najdłużej oglądane zdjęcia. */
export async function loadEngagementSummary(offerId: number): Promise<EngagementSummary> {
  const empty: EngagementSummary = { rooms: [], photos: [], totalDwellMs: 0, totalViews: 0 };
  try {
    await ensureTable();
    const [rows, photoRooms] = await Promise.all([
      prisma.$queryRawUnsafe(
        'SELECT `kind`, `itemKey`, `views`, `dwellMs` FROM `OfferEngagement` WHERE `offerId` = ?',
        offerId,
      ) as Promise<Array<{ kind: string; itemKey: string; views: number | bigint; dwellMs: number | bigint }>>,
      loadOfferPhotoRooms(offerId),
    ]);
    const roomOfPhoto = new Map(photoRooms.map((item) => [item.url, item.room]));
    const rooms = new Map<string, { room: string; views: number; dwellMs: number }>();
    const addRoom = (room: string, views: number, dwellMs: number) => {
      const key = room.toLocaleLowerCase('pl');
      const cur = rooms.get(key) || { room, views: 0, dwellMs: 0 };
      cur.views += views;
      cur.dwellMs += dwellMs;
      rooms.set(key, cur);
    };
    const photos: EngagementSummary['photos'] = [];
    let totalDwellMs = 0;
    let totalViews = 0;
    for (const row of rows) {
      const views = Number(row.views) || 0;
      const dwellMs = Number(row.dwellMs) || 0;
      if (row.kind === 'photo') {
        const room = roomOfPhoto.get(row.itemKey) || null;
        photos.push({ url: row.itemKey, room, views, dwellMs });
        totalDwellMs += dwellMs;
        totalViews += views;
        if (room) addRoom(room, views, dwellMs);
      } else {
        // Klik w pokój na planie liczymy jako 4 s uwagi — równoważy pomiar czasu zdjęć.
        addRoom(row.itemKey, views, Math.max(dwellMs, views * 4000));
      }
    }
    const roomList = [...rooms.values()].sort((a, b) => b.dwellMs - a.dwellMs);
    const roomTotal = roomList.reduce((sum, r) => sum + r.dwellMs, 0) || 1;
    return {
      rooms: roomList.map((r) => ({ ...r, share: r.dwellMs / roomTotal })),
      photos: photos.sort((a, b) => b.dwellMs - a.dwellMs).slice(0, 12),
      totalDwellMs,
      totalViews,
    };
  } catch {
    return empty;
  }
}

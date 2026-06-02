import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';

export type ProfilePromoCardRow = {
  id: string;
  userId: number;
  kind: string;
  title: string;
  subtitle: string;
  meta: string | null;
  accentColor: string | null;
  iconName: string | null;
  pillLabel: string | null;
  templateId: string | null;
  grantsFreeListing: number;
  couponUsed: number;
  purpose: string | null;
  birthdayYear: number | null;
  expiresAt: Date | null;
  createdAt: Date;
};

let tableReady = false;

export async function ensureProfilePromoCardTable() {
  if (tableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS MobileProfilePromoCard (
      id VARCHAR(64) NOT NULL,
      userId INT NOT NULL,
      kind VARCHAR(32) NOT NULL DEFAULT 'admin_promo',
      title VARCHAR(191) NOT NULL,
      subtitle VARCHAR(255) NOT NULL DEFAULT '',
      meta TEXT NULL,
      accentColor VARCHAR(32) NULL,
      iconName VARCHAR(64) NULL,
      pillLabel VARCHAR(64) NULL,
      templateId VARCHAR(64) NULL,
      grantsFreeListing TINYINT(1) NOT NULL DEFAULT 0,
      couponUsed TINYINT(1) NOT NULL DEFAULT 0,
      purpose VARCHAR(32) NULL,
      birthdayYear INT NULL,
      expiresAt DATETIME(3) NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY MobileProfilePromoCard_user_idx (userId, couponUsed, createdAt)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  tableReady = true;
}

function newCardId(userId: number): string {
  const suffix = randomBytes(6).toString('hex');
  return `promo_${userId}_${Date.now()}_${suffix}`;
}

function rowToApiCard(row: ProfilePromoCardRow) {
  const accent = String(row.accentColor || '#AF52DE').trim();
  const templateId = row.templateId || undefined;
  const kind =
    templateId === 'welcome_free_listing'
      ? 'welcome_coupon'
      : templateId === 'birthday_free_listing'
        ? 'birthday_coupon'
        : row.kind || 'admin_promo';
  return {
    id: row.id,
    kind,
    title: row.title,
    subtitle: row.subtitle || '',
    meta: row.meta || '',
    accentColor: accent,
    iconName: row.iconName || 'sparkles',
    pillLabel: row.pillLabel || (templateId === 'birthday_free_listing' ? 'Urodziny' : 'Specjalne'),
    templateId,
    grantsFreeListing: row.grantsFreeListing === 1,
    couponUsed: row.couponUsed === 1,
    purpose: row.purpose || (row.grantsFreeListing === 1 ? 'publication' : 'generic'),
    birthdayYear: row.birthdayYear ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listProfilePromoCardsForUser(userId: number) {
  await ensureProfilePromoCardTable();
  const rows = (await prisma.$queryRawUnsafe(
    `
      SELECT id, userId, kind, title, subtitle, meta, accentColor, iconName, pillLabel,
             templateId, grantsFreeListing, couponUsed, purpose, birthdayYear, expiresAt, createdAt
      FROM MobileProfilePromoCard
      WHERE userId = ?
        AND (expiresAt IS NULL OR expiresAt > NOW(3))
      ORDER BY createdAt DESC
    `,
    userId,
  )) as ProfilePromoCardRow[];
  return rows.map(rowToApiCard);
}

export async function createProfilePromoCard(
  userId: number,
  body: {
    title: string;
    subtitle?: string;
    meta?: string;
    accentColor?: string;
    iconName?: string;
    pillLabel?: string;
    templateId?: string | null;
    grantsFreeListing?: boolean;
    purpose?: string | null;
    expiresAt?: string | null;
  },
) {
  await ensureProfilePromoCardTable();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw new Error('USER_NOT_FOUND');

  const id = newCardId(userId);
  const templateId = body.templateId ? String(body.templateId).slice(0, 64) : null;
  const isBirthday = templateId === 'birthday_free_listing';
  const kind = isBirthday ? 'birthday_coupon' : 'admin_promo';
  const grants = body.grantsFreeListing === true || isBirthday ? 1 : 0;
  const year = isBirthday ? new Date().getFullYear() : null;
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO MobileProfilePromoCard
        (id, userId, kind, title, subtitle, meta, accentColor, iconName, pillLabel,
         templateId, grantsFreeListing, couponUsed, purpose, birthdayYear, expiresAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
    `,
    id,
    userId,
    kind,
    String(body.title).slice(0, 191),
    String(body.subtitle || '').slice(0, 255),
    body.meta ? String(body.meta).slice(0, 5000) : null,
    String(body.accentColor || '#FF9F0A').slice(0, 32),
    String(body.iconName || 'gift').slice(0, 64),
    String(body.pillLabel || (isBirthday ? 'Urodziny' : 'Od admina')).slice(0, 64),
    templateId,
    grants,
    body.purpose ? String(body.purpose).slice(0, 32) : grants ? 'publication' : null,
    year,
    expiresAt,
  );

  const rows = (await prisma.$queryRawUnsafe(
    `SELECT id, userId, kind, title, subtitle, meta, accentColor, iconName, pillLabel,
            templateId, grantsFreeListing, couponUsed, purpose, birthdayYear, expiresAt, createdAt
     FROM MobileProfilePromoCard WHERE id = ? LIMIT 1`,
    id,
  )) as ProfilePromoCardRow[];
  const row = rows[0];
  if (!row) throw new Error('INSERT_FAILED');
  return rowToApiCard(row);
}

export function welcomePromoCardId(userId: number): string {
  return `welcome_${userId}`;
}

/** Stały kupon powitalny w DB — wymagany do pobrania przy imporcie / publikacji z mobile. */
export async function ensureWelcomePromoCardForUser(userId: number): Promise<void> {
  await ensureProfilePromoCardTable();
  const id = welcomePromoCardId(userId);
  const existing = (await prisma.$queryRawUnsafe(
    `SELECT id, couponUsed FROM MobileProfilePromoCard WHERE id = ? AND userId = ? LIMIT 1`,
    id,
    userId,
  )) as Array<{ id: string; couponUsed: number }>;
  if (existing[0]) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstFreePublicationUsed: true },
  });
  if (!user || Number(user.firstFreePublicationUsed) > 0) return;

  await prisma.$executeRawUnsafe(
    `
      INSERT INTO MobileProfilePromoCard
        (id, userId, kind, title, subtitle, meta, accentColor, iconName, pillLabel,
         templateId, grantsFreeListing, couponUsed, purpose, birthdayYear, expiresAt)
      VALUES (?, ?, 'welcome_coupon', 'Kupon powitalny', 'Jedna darmowa publikacja pierwszej oferty',
              'Wykorzystaj przy pierwszym publicznym wystawieniu ogłoszenia.',
              '#0A84FF', 'sparkles', 'Powitalny', 'welcome_free_listing', 1, 0, 'publication', NULL, NULL)
    `,
    id,
    userId,
  );
}

export async function markProfilePromoCardUsed(userId: number, cardId: string): Promise<boolean> {
  await ensureProfilePromoCardTable();
  const normalizedId = String(cardId).slice(0, 64);
  if (normalizedId.startsWith('welcome_')) {
    await ensureWelcomePromoCardForUser(userId);
  }
  const result = await prisma.$executeRawUnsafe(
    `
      UPDATE MobileProfilePromoCard
      SET couponUsed = 1, updatedAt = NOW(3)
      WHERE id = ? AND userId = ?
    `,
    normalizedId,
    userId,
  );
  const ok = Number(result || 0) > 0;
  if (ok && normalizedId.startsWith('welcome_')) {
    await prisma.$executeRawUnsafe(
      'UPDATE `User` SET firstFreePublicationUsed = 1 WHERE id = ?',
      userId,
    );
  }
  return ok;
}

export async function getProfilePromoCardForUser(userId: number, cardId: string) {
  await ensureProfilePromoCardTable();
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT id, userId, kind, title, subtitle, meta, accentColor, iconName, pillLabel,
            templateId, grantsFreeListing, couponUsed, purpose, birthdayYear, expiresAt, createdAt
     FROM MobileProfilePromoCard WHERE id = ? AND userId = ? LIMIT 1`,
    String(cardId).slice(0, 64),
    userId,
  )) as ProfilePromoCardRow[];
  return rows[0] ? rowToApiCard(rows[0]) : null;
}

import { prisma } from '@/lib/prisma';

/**
 * Ustawienia platformy z Centrali (tabela PlatformSetting).
 * Publikacja bez moderacji: osobno dla biur i dla ogłoszeń prywatnych.
 */
export type ModerationSettings = {
  /** ogłoszenia biur (kierownik, agenci) idą na rynek od razu, bez moderacji EstateOS */
  officeAutoPublish: boolean;
  /** ogłoszenia osób prywatnych idą na rynek od razu, bez moderacji EstateOS */
  privateAutoPublish: boolean;
};

const MODERATION_KEY = 'moderation';
// Domyślnie jak dotąd: biura bez moderacji (akceptuje kierownik), prywatne przez moderację.
const MODERATION_DEFAULTS: ModerationSettings = { officeAutoPublish: true, privateAutoPublish: false };

let cache: { at: number; value: ModerationSettings } | null = null;

export async function getModerationSettings(): Promise<ModerationSettings> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  try {
    const rows = (await prisma.$queryRawUnsafe(`SELECT value FROM PlatformSetting WHERE \`key\` = ? LIMIT 1`, MODERATION_KEY)) as Array<{ value: unknown }>;
    const raw = rows[0]?.value;
    const parsed = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Partial<ModerationSettings> | null;
    const value = {
      officeAutoPublish: typeof parsed?.officeAutoPublish === 'boolean' ? parsed.officeAutoPublish : MODERATION_DEFAULTS.officeAutoPublish,
      privateAutoPublish: typeof parsed?.privateAutoPublish === 'boolean' ? parsed.privateAutoPublish : MODERATION_DEFAULTS.privateAutoPublish,
    };
    cache = { at: Date.now(), value };
    return value;
  } catch {
    return MODERATION_DEFAULTS;
  }
}

export async function setModerationSettings(next: ModerationSettings, adminUserId: number): Promise<ModerationSettings> {
  const value = { officeAutoPublish: Boolean(next.officeAutoPublish), privateAutoPublish: Boolean(next.privateAutoPublish) };
  await prisma.$executeRawUnsafe(
    `INSERT INTO PlatformSetting (\`key\`, value, updatedById) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value), updatedById = VALUES(updatedById)`,
    MODERATION_KEY,
    JSON.stringify(value),
    adminUserId,
  );
  cache = { at: Date.now(), value };
  return value;
}

/** Czy publikacja tego użytkownika idzie od razu na rynek: biuro (członek albo właściciel) czy osoba prywatna. */
export async function publishesWithoutModeration(userId: number): Promise<boolean> {
  const settings = await getModerationSettings();
  const member = await prisma.agencyCompanyMember.findUnique({ where: { userId }, select: { status: true } });
  const isOffice =
    member?.status === 'ACTIVE' || Boolean(await prisma.agencyCompany.findUnique({ where: { ownerUserId: userId }, select: { id: true } }));
  return isOffice ? settings.officeAutoPublish : settings.privateAutoPublish;
}

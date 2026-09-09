import { prisma } from "@/lib/prisma";

export const ESTATEOS_MAIL_DOMAIN = "estateos.pl";
export const MAIL_ALIAS_MAX_PER_USER = 5;
export const MAIL_ALIAS_MIN_LEN = 3;
export const MAIL_ALIAS_MAX_LEN = 32;

const RESERVED_LOCAL_PARTS = new Set(
  [
    "abuse",
    "admin",
    "administrator",
    "api",
    "billing",
    "biuro",
    "board",
    "bok",
    "ceo",
    "cloudflare",
    "contact",
    "copyright",
    "demo",
    "dns",
    "dpo",
    "estateos",
    "eos",
    "faktura",
    "faktury",
    "fondator",
    "founder",
    "ftp",
    "hello",
    "help",
    "hostmaster",
    "hr",
    "imap",
    "improvmx",
    "info",
    "invalid",
    "invoice",
    "invoices",
    "it",
    "kadry",
    "kontakt",
    "legal",
    "localhost",
    "mail",
    "marketing",
    "media",
    "newsletter",
    "noc",
    "no-reply",
    "noreply",
    "notyfikacje",
    "ns",
    "null",
    "office",
    "ops",
    "owner",
    "partner",
    "pay",
    "payments",
    "platnosc",
    "platnosci",
    "plus",
    "pomoc",
    "pop",
    "postmaster",
    "powiadomienia",
    "pr",
    "prawnik",
    "press",
    "privacy",
    "reklamacje",
    "resend",
    "rodo",
    "root",
    "sales",
    "security",
    "sklep",
    "smtp",
    "spam",
    "sprzedaz",
    "ssl",
    "stripe",
    "support",
    "system",
    "team",
    "test",
    "undefined",
    "webmaster",
    "www",
    "www2",
    "zarzad",
  ].map((v) => v.toLowerCase()),
);

let schemaEnsured = false;
let schemaPromise: Promise<void> | null = null;

export type MailAliasRow = {
  id: number;
  userId: number;
  localPart: string;
  domain: string;
  forwardTo: string;
  improvmxId: number | null;
  status: string;
  createdAt: Date;
};

export type MailAliasCheckResult =
  | { ok: true; alias: string; address: string; available: true }
  | {
      ok: true;
      alias: string;
      address: string;
      available: false;
      reason: "invalid" | "reserved" | "taken";
    };

export async function ensureEstateOsMailAliasSchema() {
  // Schema is applied by prisma/manual/sql/2026-09-09_legacy_runtime_tables.sql
  return;
}

export function normalizeMailLocalPart(raw: string): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/@estateos\.pl$/i, "");
}

export function isValidMailLocalPart(alias: string): boolean {
  if (alias.length < MAIL_ALIAS_MIN_LEN || alias.length > MAIL_ALIAS_MAX_LEN) return false;
  if (!/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])$/.test(alias)) return false;
  if (alias.includes("..") || alias.includes("--") || alias.includes("__")) return false;
  return true;
}

export function isReservedMailLocalPart(alias: string): boolean {
  return RESERVED_LOCAL_PARTS.has(alias);
}

export function formatMailAddress(alias: string): string {
  return `${alias}@${ESTATEOS_MAIL_DOMAIN}`;
}

export async function findAliasByLocalPart(alias: string): Promise<MailAliasRow | null> {
  await ensureEstateOsMailAliasSchema();
  const rows = (await prisma.$queryRawUnsafe(
    `
      SELECT id, userId, localPart, domain, forwardTo, improvmxId, status, createdAt
      FROM EstateOsMailAlias
      WHERE localPart = ? AND domain = ?
      LIMIT 1
    `,
    alias,
    ESTATEOS_MAIL_DOMAIN,
  )) as MailAliasRow[];
  return rows[0] ?? null;
}

export async function listAliasesForUser(userId: number): Promise<MailAliasRow[]> {
  await ensureEstateOsMailAliasSchema();
  return (await prisma.$queryRawUnsafe(
    `
      SELECT id, userId, localPart, domain, forwardTo, improvmxId, status, createdAt
      FROM EstateOsMailAlias
      WHERE userId = ? AND status = 'ACTIVE'
      ORDER BY id DESC
    `,
    userId,
  )) as MailAliasRow[];
}

export async function countAliasesForUser(userId: number): Promise<number> {
  await ensureEstateOsMailAliasSchema();
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS n FROM EstateOsMailAlias WHERE userId = ? AND status IN ('ACTIVE','PENDING')`,
    userId,
  )) as Array<{ n: number }>;
  return Number(rows[0]?.n || 0);
}

export function classifyLocalPart(aliasRaw: string): MailAliasCheckResult {
  const alias = normalizeMailLocalPart(aliasRaw);
  const address = formatMailAddress(alias || "login");
  if (!isValidMailLocalPart(alias)) {
    return { ok: true, alias, address: formatMailAddress(alias), available: false, reason: "invalid" };
  }
  if (isReservedMailLocalPart(alias)) {
    return { ok: true, alias, address, available: false, reason: "reserved" };
  }
  return { ok: true, alias, address, available: true };
}

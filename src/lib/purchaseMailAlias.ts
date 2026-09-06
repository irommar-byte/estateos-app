import { prisma } from "@/lib/prisma";
import {
  ESTATEOS_MAIL_DOMAIN,
  MAIL_ALIAS_MAX_PER_USER,
  classifyLocalPart,
  countAliasesForUser,
  ensureEstateOsMailAliasSchema,
  findAliasByLocalPart,
  formatMailAddress,
  type MailAliasCheckResult,
  type MailAliasRow,
} from "@/lib/estateOsMailAlias";
import { improvMxCreateAlias, improvMxGetAlias, isImprovMxConfigured } from "@/lib/improvMx";

export type MailAliasAvailability = MailAliasCheckResult & {
  provider?: "local" | "improvmx";
};

export async function checkMailAliasAvailability(raw: string): Promise<MailAliasAvailability> {
  const classified = classifyLocalPart(raw);
  if (!classified.available) return classified;

  const existing = await findAliasByLocalPart(classified.alias);
  if (existing) {
    return { ...classified, available: false, reason: "taken", provider: "local" };
  }

  if (isImprovMxConfigured()) {
    const remote = await improvMxGetAlias(ESTATEOS_MAIL_DOMAIN, classified.alias);
    if (remote.error && remote.error !== "IMPROVMX_NOT_CONFIGURED") {
      // Treat provider failures as unavailable to avoid selling a colliding name.
      if (remote.exists) {
        return { ...classified, available: false, reason: "taken", provider: "improvmx" };
      }
    } else if (remote.exists) {
      return { ...classified, available: false, reason: "taken", provider: "improvmx" };
    }
  }

  return { ...classified, provider: isImprovMxConfigured() ? "improvmx" : "local" };
}

async function refundPlusCredit(userId: number) {
  await prisma.$executeRawUnsafe(
    `UPDATE \`User\` SET extraListings = extraListings + 1 WHERE id = ?`,
    userId,
  );
}

export type PurchaseMailAliasResult =
  | { ok: true; address: string; alias: string; plusCredits: number }
  | {
      ok: false;
      error:
        | "INVALID"
        | "RESERVED"
        | "TAKEN"
        | "NOT_CONFIGURED"
        | "NO_PLUS_CREDIT"
        | "LIMIT"
        | "NO_FORWARD"
        | "PROVIDER";
      message: string;
    };

export async function purchaseMailAlias(params: {
  userId: number;
  localPart: string;
}): Promise<PurchaseMailAliasResult> {
  await ensureEstateOsMailAliasSchema();

  if (!isImprovMxConfigured()) {
    return {
      ok: false,
      error: "NOT_CONFIGURED",
      message: "Poczta @estateos.pl jest chwilowo niedostępna. Spróbuj za chwilę.",
    };
  }

  const availability = await checkMailAliasAvailability(params.localPart);
  if (!availability.available) {
    if (availability.reason === "invalid") {
      return { ok: false, error: "INVALID", message: "Login może mieć 3–32 znaki: litery, cyfry, kropka, myślnik." };
    }
    if (availability.reason === "reserved") {
      return { ok: false, error: "RESERVED", message: "Ten adres jest zarezerwowany." };
    }
    return { ok: false, error: "TAKEN", message: "Ten adres jest już zajęty." };
  }

  const owned = await countAliasesForUser(params.userId);
  if (owned >= MAIL_ALIAS_MAX_PER_USER) {
    return {
      ok: false,
      error: "LIMIT",
      message: `Możesz mieć maksymalnie ${MAIL_ALIAS_MAX_PER_USER} adresów @estateos.pl.`,
    };
  }

  const userRows = (await prisma.$queryRawUnsafe(
    `SELECT id, email, extraListings, plusExpiresAt FROM \`User\` WHERE id = ? LIMIT 1`,
    params.userId,
  )) as Array<{ id: number; email: string; extraListings: number; plusExpiresAt: Date | null }>;
  const user = userRows[0];
  if (!user?.email) {
    return { ok: false, error: "NO_FORWARD", message: "Konto nie ma adresu e-mail do przekierowania." };
  }

  const consume = await prisma.$executeRawUnsafe(
    `
      UPDATE \`User\`
      SET extraListings = GREATEST(0, extraListings - 1)
      WHERE id = ?
        AND extraListings > 0
        AND plusExpiresAt IS NOT NULL
        AND plusExpiresAt > NOW(3)
    `,
    params.userId,
  );
  if (Number(consume || 0) < 1) {
    return { ok: false, error: "NO_PLUS_CREDIT", message: "Potrzebujesz 1 kredytu Plus." };
  }

  const alias = availability.alias;
  const address = formatMailAddress(alias);
  let insertedId = 0;

  try {
    await prisma.$executeRawUnsafe(
      `
        INSERT INTO EstateOsMailAlias (userId, localPart, domain, forwardTo, status)
        VALUES (?, ?, ?, ?, 'PENDING')
      `,
      params.userId,
      alias,
      ESTATEOS_MAIL_DOMAIN,
      user.email,
    );
    const idRows = (await prisma.$queryRawUnsafe(
      `SELECT id FROM EstateOsMailAlias WHERE localPart = ? AND domain = ? LIMIT 1`,
      alias,
      ESTATEOS_MAIL_DOMAIN,
    )) as Array<{ id: number }>;
    insertedId = Number(idRows[0]?.id || 0);

    const created = await improvMxCreateAlias(ESTATEOS_MAIL_DOMAIN, alias, user.email);
    if (created.error) {
      throw new Error(created.error);
    }

    await prisma.$executeRawUnsafe(
      `UPDATE EstateOsMailAlias SET status = 'ACTIVE', improvmxId = ? WHERE id = ?`,
      created.id,
      insertedId,
    );

    const walletRows = (await prisma.$queryRawUnsafe(
      `SELECT extraListings FROM \`User\` WHERE id = ? LIMIT 1`,
      params.userId,
    )) as Array<{ extraListings: number }>;

    return {
      ok: true,
      alias,
      address,
      plusCredits: Math.max(0, Number(walletRows[0]?.extraListings || 0)),
    };
  } catch (error) {
    if (insertedId) {
      await prisma.$executeRawUnsafe(`DELETE FROM EstateOsMailAlias WHERE id = ?`, insertedId);
    } else {
      await prisma.$executeRawUnsafe(
        `DELETE FROM EstateOsMailAlias WHERE localPart = ? AND domain = ? AND userId = ?`,
        alias,
        ESTATEOS_MAIL_DOMAIN,
        params.userId,
      );
    }
    await refundPlusCredit(params.userId);
    const message = error instanceof Error ? error.message : "PROVIDER";
    if (message.toLowerCase().includes("exist") || message.toLowerCase().includes("already")) {
      return { ok: false, error: "TAKEN", message: "Ten adres jest już zajęty." };
    }
    return {
      ok: false,
      error: "PROVIDER",
      message: "Nie udało się utworzyć skrzynki. Kredyt Plus wrócił na konto.",
    };
  }
}

export function serializeAlias(row: MailAliasRow) {
  return {
    alias: row.localPart,
    address: formatMailAddress(row.localPart),
    forwardTo: row.forwardTo,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  };
}

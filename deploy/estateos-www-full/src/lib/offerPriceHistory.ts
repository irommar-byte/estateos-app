import { prisma } from "@/lib/prisma";
import { getCanonicalOfferPricePln } from "@/lib/money/offerPrice";
import {
  computePriceDiscountPercent,
  type OfferPriceHistoryRow,
} from "@/lib/offerPriceHistoryShared";

export type { OfferPriceHistoryRow };
export { computePriceDiscountPercent };

let columnsEnsured = false;
let columnsPromise: Promise<void> | null = null;

async function ensureOfferColumn(name: string, ddl: string) {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Offer' AND COLUMN_NAME = ?`,
    name,
  )) as Array<{ c: bigint | number }>;
  const exists = Number(rows[0]?.c ?? 0) > 0;
  if (!exists) {
    await prisma.$executeRawUnsafe(`ALTER TABLE \`Offer\` ADD COLUMN \`${name}\` ${ddl}`);
  }
}

async function ensureHistoryTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`OfferPriceHistory\` (
      \`id\` INT NOT NULL AUTO_INCREMENT,
      \`offerId\` INT NOT NULL,
      \`price\` DOUBLE NOT NULL,
      \`pricePln\` DOUBLE NOT NULL,
      \`priceCurrency\` VARCHAR(8) NOT NULL DEFAULT 'PLN',
      \`recordedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`changeType\` VARCHAR(16) NOT NULL DEFAULT 'INITIAL',
      \`source\` VARCHAR(32) NULL,
      PRIMARY KEY (\`id\`),
      INDEX \`OfferPriceHistory_offerId_recordedAt_idx\` (\`offerId\`, \`recordedAt\`),
      CONSTRAINT \`OfferPriceHistory_offerId_fkey\` FOREIGN KEY (\`offerId\`) REFERENCES \`Offer\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export async function ensureOfferPriceHistorySchema() {
  if (columnsEnsured) return;
  if (columnsPromise) return columnsPromise;

  columnsPromise = (async () => {
    await ensureOfferColumn("listPricePln", "DOUBLE NULL");
    await ensureHistoryTable();
    await prisma.$executeRawUnsafe(
      `UPDATE \`Offer\` SET \`listPricePln\` = COALESCE(\`pricePln\`, \`price\`) WHERE \`listPricePln\` IS NULL`,
    );
    await prisma.$executeRawUnsafe(`
      INSERT INTO \`OfferPriceHistory\` (\`offerId\`, \`price\`, \`pricePln\`, \`priceCurrency\`, \`changeType\`, \`source\`)
      SELECT o.id, o.price, COALESCE(o.pricePln, o.price), COALESCE(o.priceCurrency, 'PLN'), 'INITIAL', 'backfill'
      FROM \`Offer\` o
      WHERE NOT EXISTS (SELECT 1 FROM \`OfferPriceHistory\` h WHERE h.offerId = o.id)
    `);
    columnsEnsured = true;
  })();

  try {
    await columnsPromise;
  } finally {
    columnsPromise = null;
  }
}

export function enrichOfferPriceDiscountFields(offer: Record<string, unknown>): Record<string, unknown> {
  const current = getCanonicalOfferPricePln(offer as { pricePln?: number; price?: number });
  const listRaw = Number(offer.listPricePln);
  const listPricePln = Number.isFinite(listRaw) && listRaw > 0 ? listRaw : current;
  const discountPercent = computePriceDiscountPercent(listPricePln, current);
  const isDiscounted = discountPercent != null && discountPercent > 0;

  return {
    ...offer,
    listPricePln,
    previousPrice: isDiscounted ? listPricePln : null,
    oldPrice: isDiscounted ? listPricePln : null,
    priceDiscountPercent: discountPercent,
    isDiscounted,
  };
}

async function insertHistoryRow(params: {
  offerId: number;
  price: number;
  pricePln: number;
  priceCurrency: string;
  changeType: string;
  source: string;
}) {
  await ensureOfferPriceHistorySchema();
  await prisma.$executeRawUnsafe(
    `INSERT INTO \`OfferPriceHistory\` (\`offerId\`, \`price\`, \`pricePln\`, \`priceCurrency\`, \`changeType\`, \`source\`)
     VALUES (?, ?, ?, ?, ?, ?)`,
    params.offerId,
    params.price,
    params.pricePln,
    params.priceCurrency,
    params.changeType,
    params.source,
  );
}

async function fetchLastHistoryPricePln(offerId: number): Promise<number | null> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT pricePln FROM \`OfferPriceHistory\`
     WHERE offerId = ?
     ORDER BY recordedAt DESC, id DESC
     LIMIT 1`,
    offerId,
  )) as Array<{ pricePln: number | bigint }>;
  if (!rows.length) return null;
  const value = Number(rows[0].pricePln);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Collapse consecutive rows with the same PLN price (keeps first occurrence). */
export function dedupeConsecutivePriceHistoryRows<T extends { pricePln: number }>(rows: T[]): T[] {
  if (rows.length < 2) return rows;
  const out: T[] = [];
  for (const row of rows) {
    const prev = out[out.length - 1];
    const pln = Number(row.pricePln);
    if (prev && Number.isFinite(pln) && Math.abs(Number(prev.pricePln) - pln) < 0.01) {
      continue;
    }
    out.push(row);
  }
  return out;
}

/** Call after offer price is persisted (create or update). Only inserts when price actually changes. */
export async function syncOfferPriceHistory(params: {
  offerId: number;
  price: number;
  pricePln: number;
  priceCurrency: string;
  previousPricePln: number;
  previousListPricePln: number | null;
  source: string;
  isNewOffer?: boolean;
}) {
  const { offerId, price, pricePln, priceCurrency, source, isNewOffer } = params;
  if (!Number.isFinite(pricePln) || pricePln <= 0) return;

  await ensureOfferPriceHistorySchema();

  let listPricePln = params.previousListPricePln;
  if (listPricePln == null || !Number.isFinite(listPricePln) || listPricePln <= 0) {
    listPricePln = pricePln;
    await prisma.$executeRawUnsafe(`UPDATE \`Offer\` SET \`listPricePln\` = ? WHERE \`id\` = ?`, listPricePln, offerId);
  }

  const lastHistoryPln = await fetchLastHistoryPricePln(offerId);

  // First history row only — never insert another INITIAL if history already exists.
  if (lastHistoryPln == null) {
    await insertHistoryRow({
      offerId,
      price,
      pricePln,
      priceCurrency,
      changeType: "INITIAL",
      source,
    });
    return;
  }

  if (isNewOffer) return;

  // Authoritative gate: last recorded history price (not caller previousPricePln alone).
  if (Math.abs(lastHistoryPln - pricePln) < 0.01) return;

  const changeType = pricePln < lastHistoryPln ? "DECREASE" : "INCREASE";
  await insertHistoryRow({
    offerId,
    price,
    pricePln,
    priceCurrency,
    changeType,
    source,
  });
}

export async function fetchOfferPriceHistory(offerId: number): Promise<OfferPriceHistoryRow[]> {
  await ensureOfferPriceHistorySchema();
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT id, offerId, price, pricePln, priceCurrency, recordedAt, changeType, source
     FROM \`OfferPriceHistory\`
     WHERE offerId = ?
     ORDER BY recordedAt ASC, id ASC`,
    offerId,
  )) as OfferPriceHistoryRow[];
  const mapped = rows.map((r) => ({
    ...r,
    price: Number(r.price),
    pricePln: Number(r.pricePln),
    recordedAt: new Date(r.recordedAt),
  }));
  return dedupeConsecutivePriceHistoryRows(mapped);
}

/** Highest recorded PLN price per offer — fallback when listPricePln was backfilled to current price. */
export async function fetchMaxHistoricalPricePlnByOfferIds(
  offerIds: number[],
): Promise<Map<number, number>> {
  if (!offerIds.length) return new Map();
  await ensureOfferPriceHistorySchema();
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT offerId, MAX(pricePln) AS maxPrice
     FROM \`OfferPriceHistory\`
     WHERE offerId IN (${offerIds.join(",")})
     GROUP BY offerId`,
  )) as Array<{ offerId: number; maxPrice: number | bigint }>;
  return new Map(rows.map((row) => [Number(row.offerId), Number(row.maxPrice || 0)]));
}

export function resolveEffectiveListPricePln(
  offer: Record<string, unknown>,
  historyMaxPln?: number | null,
): number {
  const current = getCanonicalOfferPricePln(offer as { pricePln?: number; price?: number });
  const listRaw = Number(offer.listPricePln);
  const listPricePln = Number.isFinite(listRaw) && listRaw > 0 ? listRaw : current;
  const historyMax = Number(historyMaxPln);
  if (Number.isFinite(historyMax) && historyMax > listPricePln) {
    return historyMax;
  }
  return listPricePln;
}

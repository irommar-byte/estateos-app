import { prisma } from "@/lib/prisma";
import { INGEST_MONTHS, WARSAW_CITY } from "@/lib/market/constants";
import { MARKET_KINDS, type MarketKind } from "@/lib/market/marketKinds";
import { ensureMarketTables } from "@/lib/market/ensureMarketTables";
import { countWarsawSince, fetchWarsawPage } from "@/lib/market/rcnWfs";
import { assessRcnQuality } from "@/lib/market/rcnQuality";
import { resolveWarsawDistrict } from "@/lib/market/warsawDistricts";
import { recomputeWarsawAreaStats } from "@/lib/market/aggregates";
import { appendIngestHistory, writeIngestProgress } from "@/lib/market/ingestControl";
import type { RcnLocalFeature } from "@/lib/market/rcnParse";

const PAGE = 120;
const MAX_PAGES = 900;

function sinceDate() {
  const d = new Date();
  d.setMonth(d.getMonth() - INGEST_MONTHS);
  return d.toISOString().slice(0, 10);
}

/** Okna miesięczne [from, to) od bieżącego miesiąca wstecz do daty „since”. */
function monthWindows(sinceIso: string): Array<{ from: string; to: string }> {
  const since = new Date(`${sinceIso}T00:00:00Z`);
  const now = new Date();
  let to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const out: Array<{ from: string; to: string }> = [];
  while (to > since && out.length < 120) {
    const from = new Date(
      Date.UTC(to.getUTCFullYear(), to.getUTCMonth() - 1, 1),
    );
    out.push({
      from: (from < since ? since : from).toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    });
    to = from;
  }
  return out;
}

function log(message: string, extra: Record<string, unknown> = {}) {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      job: "rcn-ingest",
      message,
      ...extra,
    }),
  );
}

export async function ingestWarsawRcn(opts?: { source?: string }): Promise<{
  fetched: number;
  upserted: number;
  skipped: number;
  matched: number | null;
}> {
  await ensureMarketTables();
  const running = await prisma.marketIngestRun.findFirst({
    where: { status: "RUNNING" },
    orderBy: { startedAt: "desc" },
  });
  if (running && Date.now() - running.startedAt.getTime() < 90 * 60 * 1000) {
    throw new Error("Import RCN już trwa.");
  }

  const run = await prisma.marketIngestRun.create({
    data: { status: "RUNNING", source: opts?.source || "wfs-warsaw" },
  });

  const since = sinceDate();
  let fetched = 0;
  let upserted = 0;
  let skipped = 0;
  let matched: number | null = null;
  const kindErrors: string[] = [];
  const sampled = new Set<MarketKind>();
  // Postęp dla panelu admina: (warstwa × miesiąc) jako jednostki, w środku miesiąca — ułamek stron.
  const totalBefore = await prisma.marketTransaction.count().catch(() => 0);
  const startedAtIso = run.startedAt.toISOString();
  const allWindows = monthWindows(since);
  const units = Math.max(1, MARKET_KINDS.length * allWindows.length);
  const KIND_PL: Record<string, string> = { LOCAL: "Mieszkania", BUILDING: "Domy", PLOT: "Działki" };
  const monthLabel = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString("pl-PL", { month: "long", year: "numeric", timeZone: "UTC" });
  const report = (kindIndex: number, winIndex: number, fraction: number, kind: string, from: string, force = false) =>
    writeIngestProgress(
      {
        runId: run.id,
        percent: Math.min(99, ((kindIndex * allWindows.length + winIndex + fraction) / units) * 100),
        phase: `${KIND_PL[kind] || kind} · ${monthLabel(from)}`,
        detail: `${upserted.toLocaleString("pl-PL")} aktów zapisanych`,
        kind,
        upserted,
        startedAt: startedAtIso,
        done: false,
      },
      force,
    );
  await report(0, 0, 0, MARKET_KINDS[0], allWindows[0]?.from || since, true);

  try {
    // Mieszkania, domy i działki — błąd jednej warstwy nie zatrzymuje pozostałych.
    for (const [kindIndex, kind] of MARKET_KINDS.entries()) {
      try {
        // Miesiąc po miesiącu, od najnowszego: każde okno ma kilka tysięcy aktów, więc stronicowanie jest pewne,
        // a przerwany import i tak zostawia najświeższe dane. Koniec strony poznajemy po numberReturned,
        // nie po liczbie poprawnie odczytanych rekordów (część aktów jest odrzucana przez kontrolę jakości).
        const windows = allWindows;
        for (const [winIndex, win] of windows.entries()) {
          await report(kindIndex, winIndex, 0, kind, win.from);
          try {
            const hits = await countWarsawSince(kind, win.from, win.to).catch(
              () => null,
            );
            matched = (matched ?? 0) + (hits ?? 0);
            log("window", { kind, from: win.from, to: win.to, hits });
            if (hits === 0) continue;
            for (let page = 0; page < MAX_PAGES; page += 1) {
              const startIndex = page * PAGE;
              if (hits != null && startIndex >= hits) break;
              const { features, returned, sample } = await fetchWarsawPage({
                kind,
                sinceIsoDate: win.from,
                untilIsoDate: win.to,
                startIndex,
                count: PAGE,
              });
              if (sample && !sampled.has(kind)) {
                sampled.add(kind);
                log("sample", { kind, member: sample.slice(0, 3000) });
              }
              fetched += features.length;
              if (returned === 0) break;

              if (features.length) {
                const result = await persistFeatures(features, kind);
                upserted += result.upserted;
                skipped += result.skipped;
                await report(kindIndex, winIndex, hits ? Math.min(1, (startIndex + PAGE) / hits) : 0.5, kind, win.from);
                log("page", {
                  kind,
                  from: win.from,
                  page,
                  startIndex,
                  returned,
                  got: features.length,
                  upserted: result.upserted,
                  qualityOk: result.qualityOk,
                  flags: result.flags,
                });
              }

              // GUGiK potrafi zwrócić mniej niż `count` w środku wyników — gdy znamy hits, kończymy dopiero po nich.
              if (hits == null && returned < PAGE) break;
              await new Promise((r) => setTimeout(r, 150));
            }
          } catch (error) {
            // Jeden miesiąc z błędem serwera GUGiK nie przerywa importu pozostałych.
            log("window_failed", {
              kind,
              from: win.from,
              message: error instanceof Error ? error.message : String(error),
            });
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        kindErrors.push(`${kind}: ${message}`);
        log("kind_failed", { kind, message });
        if (kind === "LOCAL") throw error;
      }
    }

    await recomputeWarsawAreaStats();

    await prisma.marketIngestRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCESS",
        finishedAt: new Date(),
        fetched,
        upserted,
        skipped,
        error: kindErrors.length ? kindErrors.join("\n").slice(0, 4000) : null,
      },
    });
    log("done", { fetched, upserted, skipped, matched });
    const totalAfter = await prisma.marketTransaction.count().catch(() => totalBefore);
    await appendIngestHistory({
      runId: run.id,
      finishedAt: new Date().toISOString(),
      added: Math.max(0, totalAfter - totalBefore),
      total: totalAfter,
      durationSec: Math.round((Date.now() - run.startedAt.getTime()) / 1000),
      status: kindErrors.length ? "PARTIAL" : "SUCCESS",
    });
    await writeIngestProgress(
      {
        runId: run.id,
        percent: 100,
        phase: "Gotowe",
        detail: `+${Math.max(0, totalAfter - totalBefore).toLocaleString("pl-PL")} nowych aktów`,
        kind: null,
        upserted,
        startedAt: startedAtIso,
        done: true,
      },
      true,
    );
    return { fetched, upserted, skipped, matched };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await writeIngestProgress(
      { runId: run.id, percent: 0, phase: "Błąd importu", detail: message.slice(0, 200), kind: null, upserted, startedAt: startedAtIso, done: true },
      true,
    );
    await appendIngestHistory({
      runId: run.id,
      finishedAt: new Date().toISOString(),
      added: Math.max(0, (await prisma.marketTransaction.count().catch(() => totalBefore)) - totalBefore),
      total: await prisma.marketTransaction.count().catch(() => totalBefore),
      durationSec: Math.round((Date.now() - run.startedAt.getTime()) / 1000),
      status: "FAILED",
    });
    await prisma.marketIngestRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        fetched,
        upserted,
        skipped,
        error: message.slice(0, 4000),
      },
    });
    throw error;
  }
}

function toRow(
  row: RcnLocalFeature & { priceScope?: "unit" | "property" },
  kind: MarketKind,
) {
  const quality = assessRcnQuality(row, kind);
  const district = resolveWarsawDistrict({
    street: row.street,
    lat: row.lat,
    lng: row.lng,
  });
  const city = row.city || WARSAW_CITY;
  const payload = {
    sourceIip: (row.sourceIip || row.gmlId).slice(0, 64),
    unitId: row.unitId ? row.unitId.slice(0, 191) : null,
    kind,
    teryt: row.teryt || null,
    city,
    district,
    street: row.street ? row.street.slice(0, 191) : null,
    address: row.formattedAddress ? row.formattedAddress.slice(0, 255) : null,
    lat: row.lat,
    lng: row.lng,
    deedAt: row.deedAt,
    marketType: row.marketType,
    transactionKind: row.transactionKind,
    share: row.share ? row.share.slice(0, 24) : null,
    shareRatio: row.shareRatio,
    rooms: row.rooms != null ? Math.round(row.rooms) : null,
    floor: row.floor != null ? Math.round(row.floor) : null,
    areaM2: row.areaM2,
    ancillaryM2: row.ancillaryM2,
    functionCode: row.functionCode ? row.functionCode.slice(0, 48) : null,
    priceGross: row.priceGross,
    vatAmount: row.vatAmount,
    pricePerM2: quality.ppsm,
    qualityOk: quality.ok,
    qualityFlags: quality.flags.join(",") || null,
  };
  return { gmlId: row.gmlId.slice(0, 64), payload };
}

async function persistFeatures(
  features: Array<RcnLocalFeature & { priceScope?: "unit" | "property" }>,
  kind: MarketKind,
) {
  let upserted = 0;
  let skipped = 0;
  let qualityOk = 0;
  const flags: Record<string, number> = {};
  const chunk = 20;
  for (let i = 0; i < features.length; i += chunk) {
    const slice = features.slice(i, i + chunk);
    const results = await Promise.all(
      slice.map(async (row) => {
        const mapped = toRow(row, kind);
        if (mapped.payload.qualityOk) qualityOk += 1;
        for (const f of (mapped.payload.qualityFlags || "").split(",").filter(Boolean))
          flags[f] = (flags[f] || 0) + 1;
        try {
          await prisma.marketTransaction.upsert({
            where: { gmlId: mapped.gmlId },
            create: { gmlId: mapped.gmlId, ...mapped.payload },
            update: mapped.payload,
          });
          return "ok" as const;
        } catch (error) {
          console.warn(
            "[rcn-ingest] skip",
            row.gmlId,
            error instanceof Error ? error.message : error,
          );
          return "skip" as const;
        }
      }),
    );
    upserted += results.filter((r) => r === "ok").length;
    skipped += results.filter((r) => r === "skip").length;
  }
  return { upserted, skipped, qualityOk, flags };
}

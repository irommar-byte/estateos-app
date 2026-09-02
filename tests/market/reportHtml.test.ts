import test from "node:test";
import assert from "node:assert/strict";
import { buildMarketReportHtml, REPORT_PAGE1_COMPS } from "../../src/lib/market/reportHtml";
import type { MarketComp, ValuationResult } from "../../src/lib/market/types";

function resultWithComps(count: number): ValuationResult {
  const comps: MarketComp[] = Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    deedAt: "2026-03-01",
    area: 49 + (i % 3),
    rooms: 3,
    floor: i % 4,
    price: 800000 + i * 1000,
    ppsm: 16000,
    address: `Ulica ${i + 1}`,
    district: "Wilanów",
    distanceM: 50 + i * 20,
    marketType: "wtorny",
  }));
  return {
    ok: true,
    subject: {
      city: "Warszawa",
      district: "Wilanów",
      address: "Syta 181",
      lat: 52.16,
      lng: 21.08,
      area: 49,
      rooms: 3,
      floor: 0,
    },
    estimated: {
      low: 820000,
      mid: 891000,
      high: 960000,
      ppsm: 18180,
      recommendedAsk: 910000,
    },
    listingPrice: 975000,
    stats: {
      medianPpsm: 17500,
      meanPpsm: 17800,
      count: count || 12,
      radiusM: 800,
      windowMonths: 12,
      basis: "comps",
    },
    vsListing: {
      score: 72,
      tone: "high",
      label: "Powyżej porównywalnych transakcji",
      detail: "Cena ofertowa jest około 9,0% powyżej mediany.",
      vsMedianPct: 9,
    },
    comps,
    coverage: {
      city: "Warszawa",
      source: "RCN",
      ingestedAt: "2026-09-01T00:00:00.000Z",
      transactionCount: 12000,
      disclaimer: "Źródło: GUGiK, Rejestr Cen Nieruchomości.",
    },
  };
}

test("client report uses official language and keeps the market value in the document", () => {
  const html = buildMarketReportHtml(resultWithComps(4), { recipientName: "Jan Kowalski" });
  assert.match(html, /Szanowni Państwo/);
  assert.match(html, /Szacowana wartość rynkowa/);
  assert.match(html, /891/);
  assert.match(html, /Cena w ofercie/);
  assert.doesNotMatch(html, /Klient wycenia/);
  assert.doesNotMatch(html, /Cena zaproponowana przez klienta/);
  assert.match(html, /dokument dla klienta/i);
});

test("enough comparable sales add a second page", () => {
  const html = buildMarketReportHtml(resultWithComps(REPORT_PAGE1_COMPS + 5), {
    recipientName: "Anna Nowak",
  });
  assert.match(html, /Załącznik nr 1/);
  assert.match(html, /ciąg dalszy/);
  assert.match(html, /page-break-after/);
});

test("few comparable sales stay on one sheet", () => {
  const html = buildMarketReportHtml(resultWithComps(3));
  assert.doesNotMatch(html, /Załącznik nr 1/);
});

test("professional report addresses the client, not the agent email, and highlights the ask", () => {
  const html = buildMarketReportHtml(resultWithComps(4), {
    recipientName: "Mariusz Solarz",
    recipientEmail: "mariusz@example.com",
    variant: "pro",
  });
  assert.match(html, /Adresat/);
  assert.match(html, /Mariusz Solarz/);
  assert.match(html, /mariusz@example\.com/);
  assert.match(html, /Szanowny Panie,/);
  assert.match(html, /Rekomendowana cena ofertowa/);
  assert.match(html, /Cena z metra/);
  assert.match(html, /910/);
  assert.match(html, /MAPA TRANSAKCJI/);
  assert.match(html, /ta sama ulica/);
  assert.doesNotMatch(html, /agent@/);
  assert.doesNotMatch(html, /Klient wycenia/);
});

test("professional report does not put an e-mail in the greeting line as if it were a name", () => {
  const html = buildMarketReportHtml(resultWithComps(3), {
    recipientName: "agent@estateos.pl",
    recipientEmail: "wlasciciel@example.com",
    variant: "pro",
  });
  assert.doesNotMatch(html, /Szanowny Panie agent@/);
  assert.doesNotMatch(html, />agent@estateos\.pl</);
  assert.match(html, /wlasciciel@example\.com/);
});


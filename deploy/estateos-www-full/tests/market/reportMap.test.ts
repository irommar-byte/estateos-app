import test from "node:test";
import assert from "node:assert/strict";
import { buildCompsMapHtml, layoutCompsMap, streetStem } from "../../src/lib/market/reportMap";
import type { ValuationResult } from "../../src/lib/market/types";

test("street stem ignores ul. and the unit number", () => {
  assert.equal(streetStem("ul. Radzymińska 34/14"), streetStem("Radzymińska 32"));
  assert.equal(streetStem("al. Jerozolimskie 100"), streetStem("Aleje Jerozolimskie 12"));
  assert.notEqual(streetStem("Targowa 44"), streetStem("Radzymińska 34"));
});

function sampleResult(): ValuationResult {
  return {
    ok: true,
    subject: {
      city: "Warszawa",
      district: "Praga-Północ",
      address: "ul. Radzymińska 34/14",
      lat: 52.26,
      lng: 21.04,
      area: 48,
      rooms: 2,
      floor: 3,
    },
    estimated: { low: 1, mid: 1, high: 1, ppsm: 1, recommendedAsk: 1 },
    stats: {
      medianPpsm: 1,
      meanPpsm: 1,
      count: 3,
      radiusM: 800,
      windowMonths: 12,
      basis: "comps",
    },
    vsListing: null,
    comps: [
      {
        id: 1,
        deedAt: "2026-01-12",
        area: 46,
        rooms: 2,
        floor: 2,
        price: 680000,
        ppsm: 14783,
        address: "Radzymińska 32",
        district: "Praga-Północ",
        distanceM: 48,
        marketType: "wtorny",
        lat: 52.2604,
        lng: 21.0403,
      },
      {
        id: 2,
        deedAt: "2026-01-21",
        area: 51,
        rooms: 2,
        floor: 2,
        price: 780000,
        ppsm: 15294,
        address: "Targowa 44",
        district: "Praga-Północ",
        distanceM: 410,
        marketType: "pierwotny",
        lat: 52.257,
        lng: 21.045,
      },
    ],
    coverage: {
      city: "Warszawa",
      source: "RCN",
      ingestedAt: null,
      transactionCount: 1,
      disclaimer: "test",
    },
  };
}

test("comps map layout keeps real coordinates and flags the same street", () => {
  const layout = layoutCompsMap(sampleResult(), 8);
  assert.equal(layout.mapped[0].sameStreet, true);
  assert.equal(layout.mapped[1].primary, true);
  assert.deepEqual(layout.mapped[0].geo, { lat: 52.2604, lng: 21.0403 });
  assert.equal(layout.mapped[1].geo?.lat, 52.257);
});

test("comps map numbers deeds in the legend, without radar rings or overlapping street captions", async () => {
  const html = await buildCompsMapHtml(sampleResult(), 8);
  assert.match(html, /MAPA TRANSAKCJI/);
  assert.match(html, /Przedmiot/);
  assert.match(html, />1</);
  assert.match(html, /pierwotny/);
  assert.match(html, /52\.26000/);
  assert.match(html, /Radzymińska 32/);
  assert.match(html, /ta sama ulica/);
  assert.doesNotMatch(html, /stroke-dasharray/);
  assert.doesNotMatch(html, /<text[^>]*>Radzymińska/);
  assert.doesNotMatch(html, /<text[^>]*>Targowa/);
});

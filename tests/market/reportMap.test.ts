import test from "node:test";
import assert from "node:assert/strict";
import { buildCompsMapSvg, streetStem } from "../../src/lib/market/reportMap";
import type { ValuationResult } from "../../src/lib/market/types";

test("street stem ignores ul. and the unit number", () => {
  assert.equal(streetStem("ul. Radzymińska 34/14"), streetStem("Radzymińska 32"));
  assert.equal(streetStem("al. Jerozolimskie 100"), streetStem("Aleje Jerozolimskie 12"));
  assert.notEqual(streetStem("Targowa 44"), streetStem("Radzymińska 34"));
});

test("comps map keeps the subject at the centre and numbers nearby deeds", () => {
  const result: ValuationResult = {
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
  const svg = buildCompsMapSvg(result, 8);
  assert.match(svg, /MAPA TRANSAKCJI/);
  assert.match(svg, /Przedmiot/);
  assert.match(svg, />1</);
  assert.match(svg, /pierwotny/);
  assert.match(svg, /52\.26000/);
});

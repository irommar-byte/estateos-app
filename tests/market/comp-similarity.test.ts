import test from "node:test";
import assert from "node:assert/strict";
import { compSimilarityScore, sortCompsBySimilarity } from "../../src/lib/market/compSimilarity";
import type { MarketComp } from "../../src/lib/market/types";

function comp(partial: Partial<MarketComp> & { id: number }): MarketComp {
  return {
    deedAt: "2026-01-15",
    area: 50,
    rooms: 3,
    floor: 0,
    price: 800000,
    ppsm: 16000,
    address: "Test",
    district: "Wilanów",
    distanceM: 200,
    marketType: "wtorny",
    ...partial,
  };
}

const subject = { area: 49, rooms: 3, floor: 0 };

test("closer parameters beat a nearer but mismatched sale", () => {
  const closeParams = comp({
    id: 1,
    area: 48,
    rooms: 3,
    floor: 0,
    distanceM: 900,
    address: "Syta",
  });
  const closeDistance = comp({
    id: 2,
    area: 70,
    rooms: 5,
    floor: 8,
    distanceM: 40,
    address: "Nearby mismatch",
  });
  const ranked = sortCompsBySimilarity([closeDistance, closeParams], subject);
  assert.equal(ranked[0].id, 1);
  assert.ok(compSimilarityScore(closeParams, subject) < compSimilarityScore(closeDistance, subject));
});

test("same parameters keep the nearer sale first", () => {
  const farther = comp({ id: 1, distanceM: 800 });
  const nearer = comp({ id: 2, distanceM: 80 });
  const ranked = sortCompsBySimilarity([farther, nearer], subject);
  assert.equal(ranked[0].id, 2);
});

import test from "node:test";
import assert from "node:assert/strict";
import { buildAuctionUpdatePatch } from "../src/lib/auction";

const base = {
  status: "SCHEDULED",
  bidCount: 0,
  startPrice: 400000,
  reservePrice: 450000,
  minIncrement: 5000,
  startsAt: new Date("2026-10-01T10:00:00.000Z"),
  endsAt: new Date("2026-10-03T18:00:00.000Z"),
};

test("auction update allows title and window before live without bids", () => {
  const patch = buildAuctionUpdatePatch(base, {
    title: "Wieczorna licytacja",
    startsAt: "2026-10-02T10:00:00.000Z",
    endsAt: "2026-10-04T18:00:00.000Z",
    reservePrice: 460000,
  }, Date.parse("2026-09-01T00:00:00.000Z"));
  assert.equal(patch.title, "Wieczorna licytacja");
  assert.equal(patch.startsAt?.toISOString(), "2026-10-02T10:00:00.000Z");
  assert.equal(patch.reservePrice, 460000);
});

test("auction update rejects startPrice change when bids exist", () => {
  assert.throws(
    () =>
      buildAuctionUpdatePatch(
        { ...base, bidCount: 2 },
        { startPrice: 390000 },
      ),
    /START_PRICE_LOCKED/,
  );
});

test("auction update rejects live events", () => {
  assert.throws(
    () => buildAuctionUpdatePatch({ ...base, status: "LIVE" }, { title: "x" }),
    /CANNOT_EDIT/,
  );
});

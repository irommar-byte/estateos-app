import test from "node:test";
import assert from "node:assert/strict";
import { otherPortalsPresenceCount } from "../../src/lib/crm/otherPortalsPresence";

test("other portals count is stable for the same listing and week", () => {
  const createdAt = "2026-01-01T12:00:00.000Z";
  const now = Date.parse("2026-09-07T10:00:00.000Z");
  const a = otherPortalsPresenceCount(1842, createdAt, now);
  const b = otherPortalsPresenceCount(1842, createdAt, now);
  assert.equal(a, b);
  assert.ok(a >= 4);
});

test("other portals start between 4 and 7 and grow once per week", () => {
  const createdAt = "2026-01-05T00:00:00.000Z";
  const start = otherPortalsPresenceCount(99, createdAt, Date.parse("2026-01-05T12:00:00.000Z"));
  assert.ok(start >= 4 && start <= 7);
  const later = otherPortalsPresenceCount(
    99,
    createdAt,
    Date.parse("2026-01-05T00:00:00.000Z") + 21 * 24 * 60 * 60 * 1000,
  );
  assert.ok(later >= start);
  assert.equal(
    otherPortalsPresenceCount(99, createdAt, Date.parse("2026-03-01T00:00:00.000Z")),
    otherPortalsPresenceCount(99, createdAt, Date.parse("2026-03-01T00:00:00.000Z")),
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  groupPortalPath,
  marketReportPortalPath,
  portalStackKind,
} from "../../src/lib/crm/portalActivityStacks";

test("promotions collapse into one stack with a live-channel summary", () => {
  const stacks = groupPortalPath(
    [
      {
        id: 1,
        kind: "EXTERNAL_PORTAL_LISTED",
        title: "Otodom",
        body: "Opublikowano",
        createdAt: "2026-09-02T10:00:00.000Z",
        portal: "Otodom",
      },
      {
        id: 2,
        kind: "ESTATEOS_PROMOTED",
        title: "Wyróżnienie EstateOS™",
        body: "7 dni",
        createdAt: "2026-09-01T10:00:00.000Z",
        portal: "EstateOS",
      },
      {
        id: 3,
        kind: "EXTERNAL_PORTAL_LISTED",
        title: "Facebook",
        body: "grupa",
        createdAt: "2026-08-30T10:00:00.000Z",
        groupName: "Wilanów",
        portal: "Facebook",
      },
    ],
    { activePortals: ["Otodom", "Facebook"] },
  );
  assert.equal(stacks.length, 1);
  assert.equal(stacks[0].kind, "promotions");
  assert.equal(stacks[0].items.length, 3);
  assert.match(stacks[0].summary, /Teraz aktywne: Otodom, Facebook/);
  assert.match(stacks[0].summary, /3 publikacji/);
});

test("market reports are their own readable stack", () => {
  assert.equal(portalStackKind("MARKET_REPORT_SENT"), "reports");
  const stacks = groupPortalPath([
    {
      id: 44,
      kind: "MARKET_REPORT_SENT",
      title: "Raport z Rejestru Cen Nieruchomości",
      body: "Wysłano",
      createdAt: "2026-09-02T12:00:00.000Z",
    },
    {
      id: 12,
      kind: "EXTERNAL_PORTAL_LISTED",
      title: "OLX",
      body: "live",
      createdAt: "2026-09-01T12:00:00.000Z",
      portal: "OLX",
    },
  ]);
  assert.equal(stacks[0].kind, "reports");
  assert.equal(stacks[1].kind, "promotions");
  assert.equal(marketReportPortalPath("abc", 44), "/klient/abc/raport/44");
});

test("presentation and sale events land on the presentations stack", () => {
  assert.equal(portalStackKind("PRESENTATION_PROPOSED"), "presentations");
  assert.equal(portalStackKind("PRESENTATION_CHANGE_PROPOSED"), "presentations");
  assert.equal(portalStackKind("OPEN_HOUSE_CONFIRMED"), "presentations");
  assert.equal(portalStackKind("AUCTION_PROPOSAL"), "presentations");
  const stacks = groupPortalPath([
    {
      id: 1,
      kind: "OPEN_HOUSE_CONFIRMED",
      title: "Dzień otwarty",
      body: "opublikowano",
      createdAt: "2026-09-04T10:00:00.000Z",
    },
    {
      id: 2,
      kind: "PRESENTATION_PROPOSED",
      title: "Prezentacja",
      body: "termin",
      createdAt: "2026-09-03T10:00:00.000Z",
    },
  ]);
  assert.equal(stacks[0].kind, "presentations");
  assert.equal(stacks[0].items.length, 2);
});

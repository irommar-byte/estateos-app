import test from "node:test";
import assert from "node:assert/strict";
import {
  clientDecisionResolution,
  extractActiveChannels,
  filterClientMarketingTimeline,
  isActivityVisibleToClient,
  isMarketingActivityKind,
  MARKETING_ACTIVITY,
  normalizeExternalUrl,
  parseMarketingMetadata,
  shapeMarketingTimelineItem,
  shouldSendRenewalReminder,
} from "../src/lib/crm/sellerMarketing";

test("marketing kinds include canonical events", () => {
  assert.equal(
    isMarketingActivityKind(MARKETING_ACTIVITY.ESTATEOS_PROMOTED),
    true,
  );
  assert.equal(
    isMarketingActivityKind(MARKETING_ACTIVITY.EXTERNAL_PORTAL_LISTED),
    true,
  );
  assert.equal(isMarketingActivityKind("ACQUISITION_SIGNED"), false);
});

test("visibleToClient is strict opt-in", () => {
  assert.equal(isActivityVisibleToClient({}), false);
  assert.equal(isActivityVisibleToClient({ visibleToClient: false }), false);
  assert.equal(isActivityVisibleToClient({ visibleToClient: true }), true);
});

test("shapeMarketingTimelineItem maps portal metadata", () => {
  const item = shapeMarketingTimelineItem({
    id: 7,
    kind: MARKETING_ACTIVITY.EXTERNAL_PORTAL_LISTED,
    title: "Otodom",
    body: "Opublikowano",
    offerId: 12,
    createdAt: new Date("2026-09-01T10:00:00.000Z"),
    metadata: {
      visibleToClient: true,
      siteName: "Otodom",
      url: "https://www.otodom.pl/pl/oferta/test",
      status: "active",
      renewalDueAt: "2026-10-01T00:00:00.000Z",
    },
  });
  assert.equal(item.portal, "Otodom");
  assert.equal(item.externalUrl, "https://www.otodom.pl/pl/oferta/test");
  assert.equal(item.visibleToClient, true);
  assert.equal(item.renewalDueAt, "2026-10-01T00:00:00.000Z");
});

test("extractActiveChannels skips expired listings", () => {
  const channels = extractActiveChannels([
    shapeMarketingTimelineItem({
      id: 1,
      kind: MARKETING_ACTIVITY.EXTERNAL_PORTAL_LISTED,
      title: "OLX",
      body: "x",
      offerId: null,
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
      metadata: { siteName: "OLX", url: "https://olx.pl/a", status: "expired" },
    }),
    shapeMarketingTimelineItem({
      id: 2,
      kind: MARKETING_ACTIVITY.EXTERNAL_PORTAL_LISTED,
      title: "Otodom",
      body: "y",
      offerId: null,
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      metadata: {
        siteName: "Otodom",
        url: "https://otodom.pl/b",
        status: "active",
      },
    }),
  ]);
  assert.equal(channels.length, 1);
  assert.equal(channels[0].portal, "Otodom");
});

test("latest channel event wins and removed channel is not active", () => {
  const timeline = [
    shapeMarketingTimelineItem({
      id: 3,
      kind: MARKETING_ACTIVITY.EXTERNAL_PORTAL_UPDATED,
      title: "Usunięto Otodom",
      body: "removed",
      offerId: 12,
      createdAt: new Date("2026-09-03T10:00:00.000Z"),
      metadata: {
        sourceActivityId: 1,
        siteName: "Otodom",
        url: "https://otodom.pl/a",
        status: "removed",
        visibleToClient: false,
      },
    }),
    shapeMarketingTimelineItem({
      id: 1,
      kind: MARKETING_ACTIVITY.EXTERNAL_PORTAL_LISTED,
      title: "Otodom",
      body: "active",
      offerId: 12,
      createdAt: new Date("2026-09-01T10:00:00.000Z"),
      metadata: {
        siteName: "Otodom",
        url: "https://otodom.pl/a",
        status: "active",
        visibleToClient: true,
      },
    }),
  ];
  assert.deepEqual(extractActiveChannels(timeline), []);
});

test("client timeline never contains agent-only activities or channels", () => {
  const timeline = [
    shapeMarketingTimelineItem({
      id: 1,
      kind: MARKETING_ACTIVITY.EXTERNAL_PORTAL_LISTED,
      title: "Visible",
      body: "visible",
      offerId: 12,
      createdAt: new Date("2026-09-01T10:00:00.000Z"),
      metadata: {
        siteName: "Otodom",
        url: "https://otodom.pl/a",
        status: "active",
        visibleToClient: true,
      },
    }),
    shapeMarketingTimelineItem({
      id: 2,
      kind: MARKETING_ACTIVITY.EXTERNAL_PORTAL_LISTED,
      title: "Private",
      body: "private",
      offerId: 12,
      createdAt: new Date("2026-09-02T10:00:00.000Z"),
      metadata: {
        siteName: "OLX",
        url: "https://olx.pl/b",
        status: "active",
        visibleToClient: false,
      },
    }),
  ];
  const clientTimeline = filterClientMarketingTimeline(timeline);
  assert.equal(clientTimeline.length, 1);
  assert.equal(clientTimeline[0].title, "Visible");
  assert.deepEqual(
    extractActiveChannels(clientTimeline).map((item) => item.portal),
    ["Otodom"],
  );
});

test("private latest channel state suppresses an older public state", () => {
  const timeline = [
    shapeMarketingTimelineItem({
      id: 2,
      kind: MARKETING_ACTIVITY.EXTERNAL_PORTAL_UPDATED,
      title: "Internal update",
      body: "hidden",
      offerId: 12,
      createdAt: new Date("2026-09-02T10:00:00.000Z"),
      metadata: {
        sourceActivityId: 1,
        siteName: "Otodom",
        url: "https://otodom.pl/a",
        status: "active",
        visibleToClient: false,
      },
    }),
    shapeMarketingTimelineItem({
      id: 1,
      kind: MARKETING_ACTIVITY.EXTERNAL_PORTAL_LISTED,
      title: "Public listing",
      body: "visible",
      offerId: 12,
      createdAt: new Date("2026-09-01T10:00:00.000Z"),
      metadata: {
        siteName: "Otodom",
        url: "https://otodom.pl/a",
        status: "active",
        visibleToClient: true,
      },
    }),
  ];
  assert.deepEqual(extractActiveChannels(timeline, { visibleOnly: true }), []);
});

test("normalizeExternalUrl accepts https links", () => {
  assert.equal(
    normalizeExternalUrl("https://www.otodom.pl/x"),
    "https://www.otodom.pl/x",
  );
  assert.equal(normalizeExternalUrl(""), null);
});

test("parseMarketingMetadata returns object for invalid input", () => {
  assert.deepEqual(parseMarketingMetadata(null), {});
});

test("renewal reminders fire only in the three-day window", () => {
  const now = new Date("2026-09-01T09:00:00.000Z");
  assert.equal(
    shouldSendRenewalReminder(
      { status: "active", renewalDueAt: "2026-09-03T09:00:00.000Z" },
      now,
    ),
    true,
  );
  assert.equal(
    shouldSendRenewalReminder(
      { status: "active", renewalDueAt: "2026-09-10T09:00:00.000Z" },
      now,
    ),
    false,
  );
  assert.equal(
    shouldSendRenewalReminder(
      {
        status: "active",
        renewalDueAt: "2026-09-03T09:00:00.000Z",
        renewalReminderSentAt: "2026-09-01T08:00:00.000Z",
      },
      now,
    ),
    false,
  );
});

test("comment keeps a client decision pending", () => {
  assert.deepEqual(clientDecisionResolution("comment"), {
    status: "PENDING",
    resolved: false,
  });
  assert.deepEqual(clientDecisionResolution("approve"), {
    status: "APPROVED",
    resolved: true,
  });
  assert.deepEqual(clientDecisionResolution("reject"), {
    status: "REJECTED",
    resolved: true,
  });
});

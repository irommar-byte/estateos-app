import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSellerListingPath,
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

test("facebook active channel opens the post permalink not the group home", () => {
  const channels = extractActiveChannels([
    shapeMarketingTimelineItem({
      id: 1,
      kind: MARKETING_ACTIVITY.EXTERNAL_PORTAL_LISTED,
      title: "Facebook",
      body: "posted",
      offerId: 12,
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      metadata: {
        siteName: "Facebook",
        url: "https://www.facebook.com/groups/abc/posts/999/",
        groupUrl: "https://www.facebook.com/groups/abc/",
        groupName: "Warszawa",
        status: "active",
        visibleToClient: true,
      },
    }),
  ]);
  assert.equal(
    channels[0].externalUrl,
    "https://www.facebook.com/groups/abc/posts/999/",
  );
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

test("pending marketing items stay out of the client feed", () => {
  const timeline = [
    shapeMarketingTimelineItem({
      id: 1,
      kind: MARKETING_ACTIVITY.EXTERNAL_PORTAL_LISTED,
      title: "Pending FB",
      body: "not yet",
      offerId: 12,
      createdAt: new Date("2026-09-01T10:00:00.000Z"),
      metadata: {
        siteName: "Facebook",
        url: "https://facebook.com/groups/a",
        status: "pending",
        visibleToClient: true,
      },
    }),
    shapeMarketingTimelineItem({
      id: 2,
      kind: MARKETING_ACTIVITY.EXTERNAL_PORTAL_LISTED,
      title: "Otodom",
      body: "live",
      offerId: 12,
      createdAt: new Date("2026-09-02T10:00:00.000Z"),
      metadata: {
        siteName: "Otodom",
        url: "https://otodom.pl/a",
        status: "active",
        visibleToClient: true,
      },
    }),
  ];
  assert.equal(filterClientMarketingTimeline(timeline).length, 1);
  assert.equal(filterClientMarketingTimeline(timeline)[0].id, 2);
  assert.deepEqual(
    extractActiveChannels(timeline, { visibleOnly: true }).map((item) => item.portal),
    ["Otodom"],
  );
});

test("seller listing path is shared for signed and unsigned sellers", () => {
  const path = buildSellerListingPath({
    activities: [
      {
        id: 1,
        kind: MARKETING_ACTIVITY.EXTERNAL_PORTAL_LISTED,
        title: "Hidden draft",
        body: "private",
        offerId: 12,
        createdAt: new Date("2026-09-01T10:00:00.000Z"),
        metadata: {
          siteName: "Otodom",
          url: "https://otodom.pl/a",
          status: "active",
        },
      },
      {
        id: 2,
        kind: MARKETING_ACTIVITY.EXTERNAL_PORTAL_LISTED,
        title: "Facebook",
        body: "posted",
        offerId: 12,
        createdAt: new Date("2026-09-02T10:00:00.000Z"),
        metadata: {
          portal: "Facebook",
          url: "https://estateos.pl/oferta/12",
          groupName: "Warszawa mieszkania",
          groupUrl: "https://www.facebook.com/groups/warszawa.mieszkania/",
          status: "active",
          visibleToClient: true,
        },
      },
      {
        id: 3,
        kind: "LISTING_LINKED",
        title: "Powiązano ogłoszenie",
        body: "linked",
        offerId: 12,
        createdAt: new Date("2026-09-03T10:00:00.000Z"),
        metadata: {},
      },
    ],
    linkedOfferId: 12,
    listingImage: "https://cdn.example/listing.jpg",
  });
  assert.equal(path.length, 2);
  assert.equal(path[0].kind, "LISTING_LINKED");
  assert.equal(path[1].groupName, "Warszawa mieszkania");
  assert.equal(path[1].image, "https://cdn.example/listing.jpg");
});

test("visible market report lands on the seller listing path with reportId", () => {
  const path = buildSellerListingPath({
    activities: [
      {
        id: 9,
        kind: MARKETING_ACTIVITY.MARKET_REPORT,
        title: "Raport z Rejestru Cen Nieruchomości",
        body: "Dokument",
        offerId: 12,
        createdAt: new Date("2026-09-02T10:00:00.000Z"),
        metadata: {
          visibleToClient: true,
          reportId: 77,
          emails: ["owner@example.com"],
        },
      },
    ],
    linkedOfferId: 12,
  });
  assert.equal(path.length, 1);
  assert.equal(path[0].kind, "MARKET_REPORT_SENT");
  assert.equal(path[0].reportId, 77);
});

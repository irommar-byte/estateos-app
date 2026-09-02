import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSellerPortalViewState,
  filterVisibleMarketingTimeline,
  isSafeSellerPortalUrl,
  isSellerPortalPayload,
  resolveSellerPortalTimeline,
  summarizeSellerPortal,
} from "../src/lib/sellerPortalContract";
import { isClientPortalPushKind } from "../src/lib/clientPortalPushTarget";

test("isSellerPortalPayload recognizes SELLER type", () => {
  assert.equal(isSellerPortalPayload("SELLER"), true);
  assert.equal(isSellerPortalPayload("BUYER"), false);
});

test("filterVisibleMarketingTimeline hides agent-only entries", () => {
  const items = filterVisibleMarketingTimeline([
    {
      id: 1,
      kind: "MARKETING_NOTE",
      title: "A",
      body: "",
      createdAt: "",
      portal: null,
      externalUrl: null,
      status: "active",
      renewalDueAt: null,
      promotedUntil: null,
      visibleToClient: true,
    },
    {
      id: 2,
      kind: "MARKETING_NOTE",
      title: "B",
      body: "",
      createdAt: "",
      portal: null,
      externalUrl: null,
      status: "active",
      renewalDueAt: null,
      promotedUntil: null,
      visibleToClient: false,
    },
    {
      id: 3,
      kind: "MARKETING_NOTE",
      title: "C",
      body: "",
      createdAt: "",
      portal: null,
      externalUrl: null,
      status: "pending",
      renewalDueAt: null,
      promotedUntil: null,
      visibleToClient: true,
    },
    {
      id: 4,
      kind: "MARKETING_NOTE",
      title: "D",
      body: "",
      createdAt: "",
      portal: null,
      externalUrl: null,
      status: "active",
      renewalDueAt: null,
      promotedUntil: null,
    },
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].id, 1);
});

test("summarizeSellerPortal returns seller contract counters", () => {
  const summary = summarizeSellerPortal({
    type: "SELLER",
    marketingTimeline: [
      {
        id: 1,
        kind: "x",
        title: "",
        body: "",
        createdAt: "",
        portal: null,
        externalUrl: null,
        status: null,
        renewalDueAt: null,
        promotedUntil: null,
        visibleToClient: true,
      },
      {
        id: 2,
        kind: "x",
        title: "",
        body: "",
        createdAt: "",
        portal: null,
        externalUrl: null,
        status: null,
        renewalDueAt: null,
        promotedUntil: null,
        visibleToClient: false,
      },
    ],
    pendingDecisions: [{ id: 9 }],
    activeChannels: [{ portal: "Otodom" }],
  });
  assert.deepEqual(summary, {
    isSeller: true,
    timelineCount: 1,
    pendingDecisionCount: 1,
    channelCount: 1,
  });
});

test("seller marketing push opens the client portal flow", () => {
  assert.equal(isClientPortalPushKind("seller_marketing"), true);
  assert.equal(isClientPortalPushKind("CLIENT_PORTAL_MESSAGE"), true);
  assert.equal(isClientPortalPushKind("CRM_CLIENT"), false);
});

test("seller portal has a clear preparing state without a listing", () => {
  assert.deepEqual(
    buildSellerPortalViewState({
      listing: null,
      sellerNextStep: { currentStep: "Zdjęcia" },
      pendingDecisions: [{ id: 1 }],
      marketingTimeline: [],
    }),
    {
      listingState: "preparing",
      hasNextStep: true,
      pendingDecisionCount: 1,
      visibleTimelineCount: 0,
    },
  );
});

test("seller portal accepts only web links", () => {
  assert.equal(isSafeSellerPortalUrl("https://www.otodom.pl/test"), true);
  assert.equal(isSafeSellerPortalUrl("/uploads/evidence.pdf"), false);
  assert.equal(isSafeSellerPortalUrl("javascript:alert(1)"), false);
  assert.equal(isSafeSellerPortalUrl(null), false);
});

test("listingPath is the client-visible feed when present", () => {
  const timeline = resolveSellerPortalTimeline({
    listingPath: [
      {
        id: 9,
        kind: "EXTERNAL_PORTAL_LISTED",
        title: "Facebook · Warszawa",
        body: "posted",
        createdAt: "2026-09-02T00:00:00.000Z",
        url: "https://facebook.com/groups/a/posts/1",
        groupName: "Warszawa",
        status: "active",
        image: "https://cdn.example/a.jpg",
      },
    ],
    marketingTimeline: [
      {
        id: 1,
        kind: "MARKETING_NOTE",
        title: "private",
        body: "",
        createdAt: "",
        portal: null,
        externalUrl: null,
        status: "active",
        renewalDueAt: null,
        promotedUntil: null,
        visibleToClient: false,
      },
    ],
  });
  assert.equal(timeline.length, 1);
  assert.equal(timeline[0].id, 9);
  assert.equal(timeline[0].groupName, "Warszawa");
});

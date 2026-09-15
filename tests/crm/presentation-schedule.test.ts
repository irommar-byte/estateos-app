import test from "node:test";
import assert from "node:assert/strict";
import { counterpartIdFromMeta } from "../../src/lib/crm/scheduleCounterpart";
import {
  JOURNEY_ACTIVITY,
  buildJourneyStages,
  resolveMeeting,
  resolvePresentation,
} from "../../src/lib/crm/clientJourney";

test("buyer slot metadata points at the seller counterpart", () => {
  assert.equal(
    counterpartIdFromMeta(10, "BUYER", { buyerClientId: 10, sellerClientId: 22 }),
    22,
  );
});

test("seller slot metadata points at the buyer counterpart", () => {
  assert.equal(
    counterpartIdFromMeta(22, "SELLER", { buyerClientId: 10, sellerClientId: 22 }),
    10,
  );
});

test("actor is never treated as their own counterpart", () => {
  assert.equal(counterpartIdFromMeta(10, "BUYER", { buyerClientId: 10 }), null);
  assert.equal(counterpartIdFromMeta(22, "SELLER", { sellerClientId: 22 }), null);
});

test("presentation seed stays pending until someone confirms", () => {
  const slot = resolvePresentation([
    {
      id: 1,
      kind: JOURNEY_ACTIVITY.PRESENTATION,
      title: "Prezentacja",
      body: null,
      createdAt: "2026-09-02T10:00:00.000Z",
      offerId: 1228,
      metadata: {
        startsAt: "2026-09-10T16:00:00.000Z",
        status: "pending",
        proposedBy: "agent",
        buyerClientId: 10,
        sellerClientId: 22,
        offerId: 1228,
      },
    },
  ]);
  assert.equal(slot?.status, "pending");
  assert.equal(slot?.offerId, 1228);
  assert.equal(slot?.buyerClientId, 10);
  assert.equal(slot?.sellerClientId, 22);
});

test("acquisition meeting seed stays confirmed", () => {
  const slot = resolveMeeting([
    {
      id: 2,
      kind: JOURNEY_ACTIVITY.MEETING,
      title: "Spotkanie",
      body: null,
      createdAt: "2026-08-20T10:00:00.000Z",
      metadata: {
        startsAt: "2026-08-24T10:00:00.000Z",
        status: "confirmed",
        proposedBy: "agent",
      },
    },
  ]);
  assert.equal(slot?.status, "confirmed");
});

test("client change request keeps presentation pending on both ids", () => {
  const slot = resolvePresentation([
    {
      id: 1,
      kind: JOURNEY_ACTIVITY.PRESENTATION,
      title: "Prezentacja",
      body: null,
      createdAt: "2026-09-02T10:00:00.000Z",
      offerId: 1228,
      metadata: {
        startsAt: "2026-09-10T16:00:00.000Z",
        status: "pending",
        buyerClientId: 10,
        sellerClientId: 22,
      },
    },
    {
      id: 3,
      kind: JOURNEY_ACTIVITY.PRESENTATION_CHANGE,
      title: "Zmiana",
      body: null,
      createdAt: "2026-09-02T12:00:00.000Z",
      offerId: 1228,
      metadata: {
        startsAt: "2026-09-11T17:00:00.000Z",
        status: "pending",
        proposedBy: "client",
        reason: "Kolizja",
        buyerClientId: 10,
        sellerClientId: 22,
      },
    },
  ]);
  assert.equal(slot?.status, "pending");
  assert.equal(slot?.reason, "Kolizja");
  assert.equal(slot?.sellerClientId, 22);
});

test("presentation seed keeps multiple proposed slots", () => {
  const slot = resolvePresentation([
    {
      id: 1,
      kind: JOURNEY_ACTIVITY.PRESENTATION,
      title: "Prezentacja",
      body: null,
      createdAt: "2026-09-02T10:00:00.000Z",
      offerId: 1228,
      metadata: {
        startsAt: "2026-09-10T16:00:00.000Z",
        proposedSlots: ["2026-09-10T16:00:00.000Z", "2026-09-11T17:00:00.000Z"],
        status: "pending",
        proposedBy: "agent",
        showingKind: "own_import",
      },
    },
  ]);
  assert.equal(slot?.proposedSlots.length, 2);
  assert.equal(slot?.showingKind, "own_import");
});

test("held activity stamps heldAt without dropping the confirmed slot", () => {
  const slot = resolvePresentation([
    {
      id: 1,
      kind: JOURNEY_ACTIVITY.PRESENTATION,
      title: "Prezentacja",
      body: null,
      createdAt: "2026-09-02T10:00:00.000Z",
      offerId: 1228,
      metadata: {
        startsAt: "2026-09-10T16:00:00.000Z",
        status: "pending",
        proposedBy: "agent",
      },
    },
    {
      id: 2,
      kind: JOURNEY_ACTIVITY.PRESENTATION_CONFIRMED,
      title: "Potwierdzona",
      body: null,
      createdAt: "2026-09-03T10:00:00.000Z",
      offerId: 1228,
      metadata: {
        startsAt: "2026-09-10T16:00:00.000Z",
        status: "confirmed",
      },
    },
    {
      id: 3,
      kind: JOURNEY_ACTIVITY.PRESENTATION_HELD,
      title: "Odbyta",
      body: null,
      createdAt: "2026-09-10T18:00:00.000Z",
      offerId: 1228,
      metadata: {
        startsAt: "2026-09-10T16:00:00.000Z",
        heldAt: "2026-09-10T18:00:00.000Z",
      },
    },
  ]);
  assert.equal(slot?.status, "confirmed");
  assert.equal(slot?.heldAt, "2026-09-10T18:00:00.000Z");
});

test("buyer presentation is current only after a slot is sent and done only after held", () => {
  const before = buildJourneyStages({
    clientType: "BUYER",
    hasMeeting: false,
    meetingConfirmed: false,
    acquisitionStarted: false,
    signed: false,
    hasOffer: false,
    hasPresentation: false,
    presentationConfirmed: false,
    presentationHeld: false,
    hasCriteria: true,
    sentOfferCount: 2,
    reactedCount: 2,
  });
  assert.equal(before.find((s) => s.id === "presentation")?.current, false);
  assert.equal(before.find((s) => s.id === "presentation")?.done, false);

  const sent = buildJourneyStages({
    clientType: "BUYER",
    hasMeeting: false,
    meetingConfirmed: false,
    acquisitionStarted: false,
    signed: false,
    hasOffer: false,
    hasPresentation: true,
    presentationConfirmed: false,
    presentationHeld: false,
    hasCriteria: true,
    sentOfferCount: 2,
    reactedCount: 2,
  });
  assert.equal(sent.find((s) => s.id === "presentation")?.current, true);
  assert.equal(sent.find((s) => s.id === "presentation")?.done, false);

  const held = buildJourneyStages({
    clientType: "BUYER",
    hasMeeting: false,
    meetingConfirmed: false,
    acquisitionStarted: false,
    signed: false,
    hasOffer: false,
    hasPresentation: true,
    presentationConfirmed: true,
    presentationHeld: true,
    hasCriteria: true,
    sentOfferCount: 2,
    reactedCount: 2,
  });
  assert.equal(held.find((s) => s.id === "presentation")?.done, true);
  assert.equal(held.find((s) => s.id === "presentation")?.current, false);
});

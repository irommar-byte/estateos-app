import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSharedDealReviewPayload,
  DEAL_REVIEW_PREFIX,
  buildCanonicalRadarPreferencesDto,
  canFinalizeTransition,
  extractPushDealAndOfferIds,
  isFinalizedOwnerAcceptanceMessage,
  mergePushPayload,
  shouldPrioritizeDealroom,
  validateSharedDealReviewPayload,
  validateSharedDealEventPayload,
} from '../../src/contracts/parityContracts';
import { buildOfferAppDeepLink, buildOfferLandingPageUrl } from '../../src/utils/offerShareUrls';
import { extractIdFromDeeplink } from '../../src/utils/deeplinkParse';

test('owner acceptance -> finalized/review contracts', () => {
  const finalizationMsg =
    'Decyzja właściciela: oferta została wycofana z publikacji (transakcja sfinalizowana, przywrócenie wymaga kolejnych środków).';
  assert.equal(isFinalizedOwnerAcceptanceMessage(finalizationMsg), true);
  assert.equal(isFinalizedOwnerAcceptanceMessage('zwykła wiadomość'), false);
  assert.equal(DEAL_REVIEW_PREFIX, '[[DEAL_REVIEW]]');
});

test('push dealId payload -> Dealroom priority over offer fallback', () => {
  const payload = {
    target: 'dealroom',
    notificationType: 'dealroom_chat',
    targetType: 'DEAL',
    targetId: 91,
    dealId: 91,
    offerId: 22,
    screen: 'DealroomChat',
    route: 'DealroomChat',
  };
  const ids = extractPushDealAndOfferIds(payload);
  assert.equal(ids.dealId, 91);
  assert.equal(ids.offerId, 22);
  assert.equal(shouldPrioritizeDealroom(payload, ids.dealId), true);
});

test('push parser supports nested payload/body/data fields', () => {
  const merged = mergePushPayload({
    baseData: {
      data: { targetType: 'DEAL' },
      payload: { offerId: 777 },
    },
    triggerPayload: {
      body: JSON.stringify({
        dealId: 314,
        target: 'dealroom',
      }),
    },
  });
  const ids = extractPushDealAndOfferIds(merged);
  assert.equal(ids.dealId, 314);
  assert.equal(ids.offerId, 777);
  assert.equal(shouldPrioritizeDealroom(merged, ids.dealId), true);
});

test('offer-only push falls back to OfferDetail', () => {
  const payload = {
    target: 'offer',
    targetType: 'OFFER',
    targetId: 1201,
  };
  const ids = extractPushDealAndOfferIds(payload);
  assert.equal(ids.dealId, null);
  assert.equal(ids.offerId, 1201);
  assert.equal(shouldPrioritizeDealroom(payload, ids.dealId), false);
});

test('share /o/:id keeps app/web fallback parity', () => {
  const offerId = 123;
  const webUrl = buildOfferLandingPageUrl(offerId);
  const appUrl = buildOfferAppDeepLink(offerId);
  assert.equal(webUrl, 'https://estateos.pl/o/123');
  assert.equal(appUrl, 'estateos://o/123');
  assert.equal(extractIdFromDeeplink(webUrl, 'offer'), '123');
  assert.equal(extractIdFromDeeplink(appUrl, 'offer'), '123');
});

test('radar preferences use canonical DTO names', () => {
  const radar = buildCanonicalRadarPreferencesDto({
    userId: 7,
    filters: {
      transactionType: 'SELL',
      propertyType: 'ALL',
      city: 'Warszawa',
      selectedDistricts: ['Mokotow'],
      maxPrice: 1400000,
      minArea: 48,
      minYear: 2014,
      requireBalcony: true,
      requireGarden: false,
      requireElevator: true,
      requireParking: true,
      requireFurnished: false,
      pushNotifications: true,
      matchThreshold: 72,
    },
    mapContext: { lat: 52.2297, lng: 21.0122, radius: 8.4 },
  });
  assert.deepEqual(radar, {
    userId: 7,
    transactionType: 'SELL',
    propertyType: null,
    city: 'Warszawa',
    selectedDistricts: ['Mokotow'],
    maxPrice: 1400000,
    minArea: 48,
    minYear: 2014,
    requireBalcony: true,
    requireGarden: false,
    requireElevator: true,
    requireParking: true,
    requireFurnished: false,
    pushNotifications: true,
    minMatchThreshold: 72,
    lat: 52.2297,
    lng: 21.0122,
    radius: 8.4,
  });
  assert.equal('favoritesNotifyPriceChange' in radar, false);
  assert.equal('favoritesNotifyDealProposals' in radar, false);
  assert.equal('favoritesNotifyIncludeAmounts' in radar, false);
  assert.equal('favoritesNotifyStatusChange' in radar, false);
  assert.equal('favoritesNotifyNewSimilar' in radar, false);
});

test('shared DEAL_EVENT contract validates required fields', () => {
  const okBid = validateSharedDealEventPayload({
    entity: 'BID',
    action: 'PROPOSED',
    status: 'PENDING',
    amount: 820000,
    bidId: 15,
  });
  assert.ok(okBid);
  assert.equal(okBid?.entity, 'BID');

  const badBidNoAmount = validateSharedDealEventPayload({
    entity: 'BID',
    action: 'COUNTERED',
    status: 'PENDING',
  });
  assert.equal(badBidNoAmount, null);

  const okAppt = validateSharedDealEventPayload({
    entity: 'APPOINTMENT',
    action: 'ACCEPTED',
    status: 'ACCEPTED',
    proposedDate: '2026-05-06T10:00:00.000Z',
  });
  assert.ok(okAppt);

  const badApptNoDate = validateSharedDealEventPayload({
    entity: 'APPOINTMENT',
    action: 'PROPOSED',
    status: 'PENDING',
  });
  assert.equal(badApptNoDate, null);
});

test('accept -> finalized -> review scenario parity', () => {
  const finalizedSystemMessage =
    'Decyzja właściciela: oferta została wycofana z publikacji (transakcja sfinalizowana, przywrócenie wymaga kolejnych środków).';
  assert.equal(isFinalizedOwnerAcceptanceMessage(finalizedSystemMessage), true);

  const reviewPayloadRaw = {
    dealId: 123,
    targetId: 77,
    rating: 5,
    review: 'Pełen profesjonalizm, szybka finalizacja.',
    senderId: 77,
  };
  const validated = validateSharedDealReviewPayload(reviewPayloadRaw);
  assert.deepEqual(validated, {
    dealId: 123,
    targetId: 77,
    rating: 5,
    review: 'Pełen profesjonalizm, szybka finalizacja.',
    senderId: 77,
  });

  const invalidReview = validateSharedDealReviewPayload({
    dealId: 123,
    targetId: 77,
    rating: 6,
    review: 'za dużo gwiazdek',
    senderId: 77,
  });
  assert.equal(invalidReview, null);

  assert.equal(canFinalizeTransition({ dealStatus: 'AGREED', acceptedBidId: 55 }), true);
  assert.equal(canFinalizeTransition({ dealStatus: 'PENDING', acceptedBidId: 55 }), false);
  assert.equal(canFinalizeTransition({ dealStatus: 'AGREED', acceptedBidId: null }), false);
  assert.equal(canFinalizeTransition({ dealStatus: 'agreed', acceptedBidId: '55' }), true);
  assert.equal(canFinalizeTransition({ dealStatus: 'AGREED', acceptedBidId: 0 }), false);

  const canonicalReviewPayload = buildSharedDealReviewPayload({
    dealId: 123,
    targetId: 77,
    rating: 4,
    review: 'Bardzo sprawny proces.',
  });
  assert.deepEqual(canonicalReviewPayload, {
    dealId: 123,
    targetId: 77,
    rating: 4,
    review: 'Bardzo sprawny proces.',
  });
});

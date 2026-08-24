import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canSubmitOfferForOfficeActivation,
  resolveOfficeOfferUiStatus,
} from '../src/lib/crm/officeOfferStatusUi';
import { listingStatusLabel, buildListingProgress } from '../src/lib/crm/acquisitionOffer';

test('office UI: draft → review → active labels', () => {
  assert.equal(resolveOfficeOfferUiStatus({ id: 1, status: 'PENDING' }).key, 'draft');
  assert.equal(
    resolveOfficeOfferUiStatus({ id: 1, status: 'PENDING', officeReviewStatus: 'OFFICE_REVIEW' }).key,
    'review',
  );
  assert.equal(
    resolveOfficeOfferUiStatus({ id: 1, status: 'PENDING', officeReviewStatus: 'OFFICE_REJECTED' }).key,
    'rejected',
  );
  assert.equal(
    resolveOfficeOfferUiStatus({ id: 1, status: 'ACTIVE', officeReviewStatus: 'OFFICE_APPROVED' }).key,
    'active',
  );
});

test('agent can submit only editable drafts', () => {
  assert.equal(canSubmitOfferForOfficeActivation({ id: 1, status: 'PENDING' }), true);
  assert.equal(
    canSubmitOfferForOfficeActivation({ id: 1, status: 'PENDING', officeReviewStatus: 'OFFICE_REVIEW' }),
    false,
  );
  assert.equal(canSubmitOfferForOfficeActivation({ id: 1, status: 'ACTIVE' }), false);
});

test('portal listingStatusLabel never exposes PESEL and shows office review', () => {
  assert.equal(listingStatusLabel('PENDING', 'OFFICE_REVIEW'), 'Oferta weryfikowana przez biuro');
  assert.equal(listingStatusLabel('PENDING', 'OFFICE_REJECTED'), 'Wymaga poprawek biura');
  assert.equal(listingStatusLabel('ACTIVE'), 'Opublikowana');
});

test('listing progress marks office review step', () => {
  const steps = buildListingProgress({
    signed: true,
    offer: { id: 9, status: 'PENDING', officeReviewStatus: 'OFFICE_REVIEW', images: '[]' },
  });
  const published = steps.find((s) => s.id === 'published');
  assert.ok(published);
  assert.equal(published!.label, 'Oferta weryfikowana przez biuro');
  assert.equal(published!.done, false);
});

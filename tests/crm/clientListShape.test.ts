import assert from 'node:assert/strict';
import test from 'node:test';
import { shapeClientListItem } from '../../src/lib/agencyClientShape';

test('client list item carries pipeline fields from the batch query', () => {
  const item = shapeClientListItem(
    {
      id: 44,
      type: 'SELLER',
      firstName: 'Anna',
      lastName: 'Kowalska',
      email: 'anna@example.com',
      phone: '+48500111222',
      pesel: null,
      emailVerifiedAt: null,
      phoneVerifiedAt: null,
      notes: null,
      updatedAt: new Date('2026-09-10T10:00:00.000Z'),
      sellerCity: 'Warszawa',
      sellerPrice: 900000,
      linkedUserId: null,
      linkedOfferId: 1228,
      linkedOffer: { status: 'ACTIVE' },
      portalToken: 'portal-token',
      buyerPreference: null,
      _count: { matches: 0 },
      matches: [],
      activities: [
        {
          kind: 'ACQUISITION_MEETING',
          metadata: { startsAt: '2026-09-01T10:00:00.000Z', status: 'confirmed' },
        },
      ],
    },
    { acquisitionSigned: true, sentCount: 0 },
  );

  assert.equal(item.linkedOfferId, 1228);
  assert.equal(item.linkedOfferStatus, 'ACTIVE');
  assert.equal(item.acquisitionSigned, true);
  assert.equal(item.meetingConfirmed, true);
  assert.equal(item.portalUrl?.includes('/klient/portal-token'), true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCrmPersonOrder,
  crmPersonKey,
  formatCrmRoleLabel,
  groupCrmClientsByPerson,
} from '../src/lib/crmPersonGroups';

test('same email and phone collapse into one person card', () => {
  const groups = groupCrmClientsByPerson([
    {
      id: 11,
      type: 'BUYER',
      firstName: 'Joanna',
      lastName: 'Pani',
      email: 'joasia147@op.pl',
      phone: '+48500111222',
      updatedAt: '2026-09-01T10:00:00.000Z',
    },
    {
      id: 12,
      type: 'BUYER',
      firstName: 'Joanna',
      lastName: 'Pani',
      email: 'joasia147@op.pl',
      phone: '+48500111222',
      updatedAt: '2026-09-03T10:00:00.000Z',
    },
    {
      id: 21,
      type: 'SELLER',
      firstName: 'Mariusz',
      lastName: 'Solarz',
      email: 'mariuszb4@wp.pl',
      updatedAt: '2026-09-02T10:00:00.000Z',
    },
  ]);
  assert.equal(groups.length, 2);
  const joanna = groups.find((g) => g.primary.firstName === 'Joanna');
  assert.equal(joanna?.ids.length, 2);
  assert.equal(joanna?.primary.id, 12);
});

test('seller who also searches stays one person with both roles', () => {
  const groups = groupCrmClientsByPerson([
    {
      id: 7,
      type: 'SELLER',
      firstName: 'Mariusz',
      lastName: 'Solarz',
      email: 'mariuszb4@wp.pl',
      pesel: '77030803059',
      updatedAt: '2026-09-01T10:00:00.000Z',
    },
    {
      id: 8,
      type: 'BUYER',
      firstName: 'Mariusz',
      lastName: 'Solarz',
      email: 'mariuszb4@wp.pl',
      pesel: '77030803059',
      updatedAt: '2026-09-04T10:00:00.000Z',
    },
  ]);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].types, ['SELLER', 'BUYER']);
  assert.equal(groups[0].primary.type, 'SELLER');
  assert.equal(formatCrmRoleLabel(groups[0].types), 'SPRZEDAJĄCY / KUPUJĄCY');
});

test('person key prefers linked account over email', () => {
  assert.equal(
    crmPersonKey({
      id: 1,
      type: 'BUYER',
      firstName: 'A',
      lastName: 'B',
      email: 'a@b.pl',
      linkedUserId: 99,
      updatedAt: '2026-09-01T00:00:00.000Z',
    }),
    'u:99',
  );
});

test('saved order is applied before recency', () => {
  const groups = groupCrmClientsByPerson([
    {
      id: 1,
      type: 'BUYER',
      firstName: 'Anna',
      lastName: 'A',
      email: 'a@a.pl',
      updatedAt: '2026-09-04T00:00:00.000Z',
    },
    {
      id: 2,
      type: 'SELLER',
      firstName: 'Bartek',
      lastName: 'B',
      email: 'b@b.pl',
      updatedAt: '2026-09-01T00:00:00.000Z',
    },
  ]);
  const ordered = applyCrmPersonOrder(groups, [crmPersonKey(groups[1].primary), crmPersonKey(groups[0].primary)]);
  assert.equal(ordered[0].primary.firstName, 'Bartek');
});

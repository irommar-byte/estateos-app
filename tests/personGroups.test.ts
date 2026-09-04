import test from 'node:test';
import assert from 'node:assert/strict';
import { crmPersonKey, formatCrmRoleLabel, groupCrmClientsByPerson } from '../src/lib/crm/personGroups';

test('seller plus buyer with the same email is one person', () => {
  const groups = groupCrmClientsByPerson([
    {
      id: 7,
      type: 'SELLER',
      firstName: 'Mariusz',
      lastName: 'Solarz',
      email: 'mariuszb4@wp.pl',
      updatedAt: '2026-09-01T10:00:00.000Z',
    },
    {
      id: 8,
      type: 'BUYER',
      firstName: 'Mariusz',
      lastName: 'Solarz',
      email: 'mariuszb4@wp.pl',
      updatedAt: '2026-09-04T10:00:00.000Z',
    },
  ]);
  assert.equal(groups.length, 1);
  assert.equal(formatCrmRoleLabel(groups[0].types), 'SPRZEDAJĄCY / KUPUJĄCY');
  assert.equal(groups[0].primary.id, 7);
});

test('crmPersonKey uses last 9 phone digits', () => {
  assert.equal(
    crmPersonKey({
      id: 3,
      type: 'BUYER',
      firstName: 'A',
      lastName: 'B',
      phone: '+48 500 111 222',
      updatedAt: '2026-09-01T00:00:00.000Z',
    }),
    't:500111222',
  );
});

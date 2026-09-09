import assert from 'node:assert/strict';
import test from 'node:test';
import {
  KEI_MAX_ATTEMPTS,
  isKeiLeaseClaimable,
} from '../src/lib/keiImportLease';

const now = new Date('2026-09-09T10:00:00.000Z');

test('only queued or expired KEI jobs are claimable', () => {
  assert.equal(
    isKeiLeaseClaimable(
      { status: 'queued', cancelRequested: false, attemptCount: 0, leaseUntil: null },
      now,
    ),
    true,
  );
  assert.equal(
    isKeiLeaseClaimable(
      {
        status: 'running',
        cancelRequested: false,
        attemptCount: 1,
        leaseUntil: new Date('2026-09-09T09:59:00.000Z'),
      },
      now,
    ),
    true,
  );
  assert.equal(
    isKeiLeaseClaimable(
      {
        status: 'running',
        cancelRequested: false,
        attemptCount: 1,
        leaseUntil: new Date('2026-09-09T10:01:00.000Z'),
      },
      now,
    ),
    false,
  );
});

test('cancelled and exhausted KEI jobs cannot be claimed', () => {
  assert.equal(
    isKeiLeaseClaimable(
      { status: 'queued', cancelRequested: true, attemptCount: 0, leaseUntil: null },
      now,
    ),
    false,
  );
  assert.equal(
    isKeiLeaseClaimable(
      {
        status: 'running',
        cancelRequested: false,
        attemptCount: KEI_MAX_ATTEMPTS,
        leaseUntil: new Date('2026-09-09T09:00:00.000Z'),
      },
      now,
    ),
    false,
  );
});

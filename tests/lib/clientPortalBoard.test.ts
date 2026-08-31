import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultOpenStackIds } from '../../src/lib/clientPortalBoard';

test('defaultOpenStackIds prefers new, then like, maybe, dislike', () => {
  assert.deepEqual(
    defaultOpenStackIds({ new: [{ id: 1 }], like: [], maybe: [{ id: 2 }], dislike: [] }),
    ['new'],
  );
  assert.deepEqual(
    defaultOpenStackIds({ new: [], like: [{ id: 1 }], maybe: [{ id: 2 }], dislike: [] }),
    ['like'],
  );
  assert.deepEqual(
    defaultOpenStackIds({ new: [], like: [], maybe: [{ id: 2 }], dislike: [{ id: 3 }] }),
    ['maybe'],
  );
  assert.deepEqual(defaultOpenStackIds({ new: [], like: [], maybe: [], dislike: [] }), []);
});

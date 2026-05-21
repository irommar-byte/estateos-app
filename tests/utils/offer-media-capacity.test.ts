import test from 'node:test';
import assert from 'node:assert/strict';

import {
  OFFER_MEDIA_UPLOAD_CAP_BYTES,
  OFFER_MEDIA_PICKER_BUDGET_BYTES,
  canAcceptDraftImage,
  sumEstimatedUploadBytes,
} from '../../src/utils/offerMediaCapacity';

test('sumEstimatedUploadBytes', () => {
  assert.equal(sumEstimatedUploadBytes(['a', 'b'], { a: 1000, b: 2000 }), 3000);
});

test('rejects when upload cap exceeded', () => {
  const cap = OFFER_MEDIA_UPLOAD_CAP_BYTES;
  const r = canAcceptDraftImage({
    currentUris: ['a'],
    sizes: { a: cap - 100 },
    newEstimatedBytes: 200,
    pickerReportedBytes: null,
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'upload_cap');
});

test('allows heavy HEIC picker size within picker budget', () => {
  const r = canAcceptDraftImage({
    currentUris: [],
    sizes: {},
    newEstimatedBytes: 1.5 * 1024 * 1024,
    pickerReportedBytes: 18 * 1024 * 1024,
    newUri: 'file:///photo.heic',
  });
  assert.equal(r.ok, true);
  assert.ok(OFFER_MEDIA_PICKER_BUDGET_BYTES > OFFER_MEDIA_UPLOAD_CAP_BYTES);
});

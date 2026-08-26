import test from 'node:test';
import assert from 'node:assert/strict';
import { offerCardPreviewPath, offerSharePath } from '../src/lib/publicListingPath';

test('share path stays on /o/id for Facebook OG', () => {
  assert.equal(offerSharePath(1228, { presentingAgentId: 55 }), '/o/1228?agent=55');
});

test('preview path opens the QR business card', () => {
  assert.equal(offerCardPreviewPath(1228, { presentingAgentId: 55 }), '/o/1228/karta?agent=55');
  assert.equal(offerCardPreviewPath(1228, { portalToken: 'abc' }), '/o/1228/karta?portal=abc');
});

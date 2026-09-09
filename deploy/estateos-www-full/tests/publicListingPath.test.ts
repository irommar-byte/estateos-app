import test from 'node:test';
import assert from 'node:assert/strict';
import { offerCardPreviewPath, offerSharePath } from '../src/lib/publicListingPath';

test('share path stays on /o/id for Facebook OG', () => {
  assert.equal(offerSharePath(1228, { presentingAgentId: 55 }), '/o/1228?agent=55');
});

test('facebook share path adds an og stamp after a price or title edit', () => {
  assert.equal(
    offerSharePath(1228, { presentingAgentId: 55, ogStamp: 'p949000-t1757400000-habc' }),
    '/o/1228?agent=55&og=p949000-t1757400000-habc',
  );
});

test('preview path opens the QR business card', () => {
  assert.equal(offerCardPreviewPath(1228, { presentingAgentId: 55 }), '/o/1228/karta?agent=55');
  assert.equal(offerCardPreviewPath(1228, { portalToken: 'abc' }), '/o/1228/karta?portal=abc');
});

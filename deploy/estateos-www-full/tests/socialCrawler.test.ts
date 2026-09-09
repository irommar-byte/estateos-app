import test from 'node:test';
import assert from 'node:assert/strict';
import { isSocialShareCrawler } from '../src/lib/socialCrawler';

test('detects Facebook and Messenger scrapers', () => {
  assert.equal(isSocialShareCrawler('facebookexternalhit/1.1'), true);
  assert.equal(isSocialShareCrawler('Facebot'), true);
  assert.equal(isSocialShareCrawler('Mozilla/5.0 (Macintosh) Safari'), false);
});

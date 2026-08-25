import test from 'node:test';
import assert from 'node:assert/strict';
import {
  editorialToHtml,
  insertEditorialMark,
  parseListingDescription,
} from '../../src/utils/listingDescriptionFormat';

test('parses editorial listing copy', () => {
  const blocks = parseListingDescription('Atuty\n• salon\n✓ winda\n——————\n**Zapraszamy**');
  assert.equal(blocks[0]?.type, 'heading');
  assert.equal(blocks.some((b) => b.type === 'bullet'), true);
  assert.equal(blocks.some((b) => b.type === 'check'), true);
  assert.equal(blocks.some((b) => b.type === 'separator'), true);
});

test('wraps selection with bold marks', () => {
  const next = insertEditorialMark('salon duży', { start: 6, end: 10 }, 'bold');
  assert.equal(next.text, 'salon **duży**');
});

test('html round-trip keeps checks', () => {
  const html = editorialToHtml('✓ ogród');
  const blocks = parseListingDescription(html);
  assert.equal(blocks[0]?.type, 'check');
});

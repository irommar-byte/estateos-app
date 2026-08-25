import test from 'node:test';
import assert from 'node:assert/strict';
import {
  editorialToHtml,
  htmlToEditorial,
  insertEditorialMark,
  parseListingDescription,
} from '../src/lib/listingDescriptionFormat';
import { listingDescriptionToSafeHtml, sanitizeOfferDescriptionHtml } from '../src/lib/offerDescriptionHtml';

test('turns bullets, checks and separators into HTML', () => {
  const html = editorialToHtml(`Prezentujemy **jasne** mieszkanie.

Atuty
• salon z aneksem
✓ balkon
——————
Zapraszamy.`);
  assert.match(html, /<strong>jasne<\/strong>/);
  assert.match(html, /<h3>Atuty<\/h3>/);
  assert.match(html, /<li>salon z aneksem<\/li>/);
  assert.match(html, /data-kind="check"/);
  assert.match(html, /<hr>/);
});

test('keeps check markers through sanitize', () => {
  const html = editorialToHtml('✓ winda\n✓ komórka');
  const safe = sanitizeOfferDescriptionHtml(html);
  assert.match(safe, /data-kind="check"/);
  const back = htmlToEditorial(safe);
  assert.match(back, /✓ winda/);
});

test('parses mixed HTML from the web editor', () => {
  const blocks = parseListingDescription('<p>Witamy</p><ul><li data-kind="check">parking</li><li>balkon</li></ul><hr>');
  assert.equal(blocks.some((b) => b.type === 'check'), true);
  assert.equal(blocks.some((b) => b.type === 'bullet'), true);
  assert.equal(blocks.some((b) => b.type === 'separator'), true);
});

test('inserts editorial marks at the caret', () => {
  const next = insertEditorialMark('Salon.', { start: 6, end: 6 }, 'check');
  assert.equal(next.text, 'Salon.\n✓ ');
});

test('plain editorial becomes safe HTML for the listing page', () => {
  const safe = listingDescriptionToSafeHtml('• światło 🌿\n__balkon__');
  assert.match(safe, /<li>/);
  assert.match(safe, /<u>balkon<\/u>/);
});

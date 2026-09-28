import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  fitDescriptionToTarget,
  maxTokensForLength,
  resolveGenerateTitle,
  trimToCompleteBoundary,
} from '../src/lib/listingDescriptionLength';

describe('listing description soft-fit', () => {
  it('does not cut mid-sentence when over target', () => {
    const body =
      'Prezentujemy Państwu wyjątkowe mieszkanie w Wilanowie.\n\n' +
      'Atuty lokalu\n' +
      '• Salon z aneksem\n' +
      '• Suterena na poziomie -1 z oknem\n\n' +
      'Dla kogo\n' +
      '✓ Dla rodzin z dziećmi, które cenią sobie przestrzeń i komfort.\n' +
      '✓ Dla wszystkich, którzy pragną spokojnego życia blisko jeziora.';
    const long = body + '\n\n' + 'Okolica jest świetna. '.repeat(40);
    const fitted = fitDescriptionToTarget(long, 500);
    assert.ok(fitted.length <= 650, `expected soft max, got ${fitted.length}`);
    assert.ok(!/pragną$/.test(fitted.trim()), 'must not end mid-phrase like screen cut');
  });

  it('trimToCompleteBoundary prefers last full sentence', () => {
    const text = 'Pierwsze zdanie. Drugie zdanie kończy się tutaj. Trzecie niedokończon';
    const out = trimToCompleteBoundary(text, 20, 55);
    assert.match(out, /tutaj\./);
    assert.ok(!out.includes('niedokończon'));
  });

  it('maxTokensForLength gives room for Polish at 2500', () => {
    const tokens = maxTokensForLength(2500);
    assert.ok(tokens >= 2100, `expected >=2100, got ${tokens}`);
    assert.ok(tokens <= 2800);
  });

  it('resolveGenerateTitle accepts truthy flags', () => {
    assert.equal(resolveGenerateTitle(true), true);
    assert.equal(resolveGenerateTitle('true'), true);
    assert.equal(resolveGenerateTitle(false), false);
    assert.equal(resolveGenerateTitle(undefined), false);
  });

  it('keeps suterena content when trimming padded text', () => {
    const core =
      'Mieszkanie z **sutereną** na poziomie -1 zamiast komórki lokatorskiej. Idealne jako dodatkowa przestrzeń.';
    const padded = `${core}\n\n${'Tekst okolicy. '.repeat(80)}`;
    const fitted = fitDescriptionToTarget(padded, 500);
    assert.match(fitted, /suteren/i);
  });
});

describe('listing description model split helpers', () => {
  it('rewrite model prefers listing rewrite env then default', async () => {
    const { resolveListingDescriptionModel } = await import('../src/lib/listingDescriptionAi');
    const prevRewrite = process.env.OPENAI_LISTING_REWRITE_MODEL;
    const prevListing = process.env.OPENAI_LISTING_MODEL;
    const prevCheap = process.env.OPENAI_LISTING_CHEAP_MODEL;
    try {
      delete process.env.OPENAI_LISTING_REWRITE_MODEL;
      delete process.env.OPENAI_LISTING_MODEL;
      delete process.env.OPENAI_LISTING_CHEAP_MODEL;
      assert.equal(resolveListingDescriptionModel(true), 'gpt-5-mini');
      assert.equal(resolveListingDescriptionModel(false), 'gpt-4o-mini');
      process.env.OPENAI_LISTING_CHEAP_MODEL = 'gpt-4o-mini';
      process.env.OPENAI_LISTING_REWRITE_MODEL = 'gpt-5-mini';
      assert.equal(resolveListingDescriptionModel(true), 'gpt-5-mini');
      assert.equal(resolveListingDescriptionModel(false), 'gpt-4o-mini');
    } finally {
      if (prevRewrite === undefined) delete process.env.OPENAI_LISTING_REWRITE_MODEL;
      else process.env.OPENAI_LISTING_REWRITE_MODEL = prevRewrite;
      if (prevListing === undefined) delete process.env.OPENAI_LISTING_MODEL;
      else process.env.OPENAI_LISTING_MODEL = prevListing;
      if (prevCheap === undefined) delete process.env.OPENAI_LISTING_CHEAP_MODEL;
      else process.env.OPENAI_LISTING_CHEAP_MODEL = prevCheap;
    }
  });
});

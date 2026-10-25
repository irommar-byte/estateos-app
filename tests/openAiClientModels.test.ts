import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OPENAI_MODEL_DEFAULT,
  OPENAI_MODEL_LEGACY,
  buildModelFallbackChain,
  estimateOpenAiCostMicroUsd,
  usesResponsesApi,
} from '../src/lib/openAiClient';

test('new model families use the Responses API, legacy chat models do not', () => {
  assert.ok(usesResponsesApi('gpt-6-luna'));
  assert.ok(usesResponsesApi('gpt-6.1-sol'));
  assert.ok(usesResponsesApi('gpt-5.4-mini'));
  assert.ok(usesResponsesApi('o3'));
  assert.ok(!usesResponsesApi('gpt-4o-mini'));
});

test('retired models are upgraded and the chain ends on the legacy model', () => {
  const chain = buildModelFallbackChain('gpt-5-mini');
  assert.equal(chain[0], OPENAI_MODEL_DEFAULT);
  assert.equal(chain[chain.length - 1], OPENAI_MODEL_LEGACY);
  assert.ok(!chain.includes('o4-mini'));
  assert.equal(new Set(chain).size, chain.length);
});

test('cost estimate for a typical import rewrite stays around a tenth of a cent', () => {
  const micro = estimateOpenAiCostMicroUsd('gpt-6-luna', { inputTokens: 3000, outputTokens: 1400 });
  assert.equal(micro, 1000);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  fitDescriptionToTarget,
  maxTokensForLength,
  needsDescriptionExpand,
  resolveTargetLength,
  resolveUseEmojis,
  stripEmojiCharacters,
} from "../src/lib/listingDescriptionLength";

test("snaps target length to nearest 500 in 500–4000", () => {
  assert.equal(resolveTargetLength(undefined), 1500);
  assert.equal(resolveTargetLength(740), 500);
  assert.equal(resolveTargetLength(760), 1000);
  assert.equal(resolveTargetLength(3999), 4000);
  assert.equal(resolveTargetLength(12), 500);
});

test("emoji flag is opt-in", () => {
  assert.equal(resolveUseEmojis(undefined), false);
  assert.equal(resolveUseEmojis(true), true);
  assert.equal(resolveUseEmojis("true"), true);
});

test("trims long copy on a sentence boundary inside ±50", () => {
  const head = "A".repeat(1460);
  const text = `${head} Pierwsze zdanie. Drugie zdanie kończy się tutaj.`;
  const fitted = fitDescriptionToTarget(text, 1500);
  assert.ok(fitted.length >= 1450 && fitted.length <= 1550);
  assert.match(fitted, /zdanie/);
});

test("expand is needed only below the floor", () => {
  assert.equal(needsDescriptionExpand("x".repeat(1449), 1500), true);
  assert.equal(needsDescriptionExpand("x".repeat(1450), 1500), false);
});

test("strips emoji when requested", () => {
  assert.equal(stripEmojiCharacters("Salon 🌿 i balkon ✨."), "Salon i balkon .");
});

test("token budget scales with length and caps at 1800", () => {
  assert.equal(maxTokensForLength(500), Math.ceil(500 / 2.2) + 80);
  assert.equal(maxTokensForLength(4000), 1800);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  fitDescriptionToTarget,
  maxTokensForLength,
  needsDescriptionExpand,
  resolveGenerateTitle,
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

test("title flag is opt-in", () => {
  assert.equal(resolveGenerateTitle(undefined), false);
  assert.equal(resolveGenerateTitle(true), true);
  assert.equal(resolveGenerateTitle("1"), true);
});

test("trims long copy on a sentence boundary inside soft ±150", () => {
  const head = "A".repeat(1460);
  const text = `${head} Pierwsze zdanie. Drugie zdanie kończy się tutaj.`;
  const fitted = fitDescriptionToTarget(text, 1500);
  assert.ok(fitted.length >= 1350 && fitted.length <= 1650);
  assert.match(fitted, /zdanie/);
});

test("expand is needed only below the soft floor (±150)", () => {
  assert.equal(needsDescriptionExpand("x".repeat(1349), 1500), true);
  assert.equal(needsDescriptionExpand("x".repeat(1350), 1500), false);
});

test("strips emoji when requested", () => {
  assert.equal(stripEmojiCharacters("Salon 🌿 i balkon ✨."), "Salon i balkon .");
});

test("token budget scales with length and caps at 2200", () => {
  assert.equal(maxTokensForLength(500), Math.ceil(500 / 1.6) + 120);
  assert.equal(maxTokensForLength(4000), 2200);
});

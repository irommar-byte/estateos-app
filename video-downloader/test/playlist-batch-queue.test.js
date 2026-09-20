import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createPlaylistBatchQueue } from "../playlist-batch-queue.js";
test("one list becomes one batch and continues without the phone", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-batch-"));
  const started = [];
  const queue = createPlaylistBatchQueue({
    filePath: path.join(dir, "batch.json"),
    ensureMusicAsset: async ({ url }) => {
      started.push(url);
      return { jobId: url, persistent: true, onServer: true, ready: true };
    },
    cancelJob: async () => {},
  });
  const tracks = Array.from({ length: 5 }, (_, i) => ({ url: `https://music.apple.com/song/${i}`, title: `T${i}` }));
  const first = queue.enqueue({ userKey: "u1", folderId: "f1", label: "Lista", tracks });
  const second = queue.enqueue({ userKey: "u1", folderId: "f1", label: "Lista", tracks });
  assert.equal(first.batchId, second.batchId);
  assert.equal(first.queued, 5);
  await new Promise((r) => setTimeout(r, 80));
  const snap = queue.snapshot("u1", first.batchId);
  assert.ok(snap.revision >= 1);
  assert.equal(started.length >= 1, true);
});

test("cancel removes active and pending", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-batch-"));
  let cancelled = [];
  const queue = createPlaylistBatchQueue({
    filePath: path.join(dir, "batch.json"),
    ensureMusicAsset: async ({ url }) => {
      await new Promise((r) => setTimeout(r, 30));
      return { jobId: url, persistent: false, onServer: false, ready: false, poll: async () => ({ progress: 10 }) };
    },
    cancelJob: async (jobId) => { cancelled.push(jobId); },
  });
  const enq = queue.enqueue({
    userKey: "u1",
    folderId: "f1",
    label: "Lista",
    tracks: [
      { url: "https://music.apple.com/song/1", title: "A" },
      { url: "https://music.apple.com/song/2", title: "B" },
    ],
  });
  await new Promise((r) => setTimeout(r, 20));
  await queue.cancel({ userKey: "u1", batchId: enq.batchId });
  const snap = queue.snapshot("u1", enq.batchId);
  assert.equal(snap.status, "cancelled");
});

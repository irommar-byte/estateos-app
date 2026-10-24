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


test("three slots run in parallel", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-batch-"));
  let inflight = 0;
  let maxInflight = 0;
  const queue = createPlaylistBatchQueue({
    filePath: path.join(dir, "batch.json"),
    ensureMusicAsset: async ({ url }) => {
      inflight += 1;
      maxInflight = Math.max(maxInflight, inflight);
      await new Promise((r) => setTimeout(r, 40));
      inflight -= 1;
      return { jobId: url, persistent: true, onServer: true, ready: true };
    },
    cancelJob: async () => {},
  });
  const tracks = Array.from({ length: 6 }, (_, i) => ({ url: `https://music.apple.com/song/${i}`, title: `T${i}` }));
  queue.enqueue({ userKey: "u1", folderId: "f1", label: "Lista", tracks });
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(maxInflight, 3);
  const snap = queue.snapshot("u1");
  assert.ok((snap.currentItems || []).length <= 3);
});

test("overall progress sums three live slots", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-batch-"));
  const queue = createPlaylistBatchQueue({
    filePath: path.join(dir, "batch.json"),
    ensureMusicAsset: async ({ url }) => ({
      jobId: url,
      persistent: false,
      poll: async () => ({ progress: 50 }),
    }),
    cancelJob: async () => {},
  });
  const tracks = Array.from({ length: 10 }, (_, i) => ({ url: `https://music.apple.com/song/${i}`, title: `T${i}` }));
  const enq = queue.enqueue({ userKey: "u1", folderId: "f1", label: "Lista", tracks });
  await new Promise((r) => setTimeout(r, 40));
  const snap = queue.snapshot("u1");
  assert.equal(snap.total, 10);
  assert.ok(snap.overallProgress > 0);
  assert.ok(snap.overallProgress < 0.2);
  assert.ok((snap.currentItems || []).length === 3);
  await queue.cancel({ userKey: "u1", batchId: enq.batchId });
});

test("stuck finalize above 96 percent retries then continues", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-batch-"));
  let calls = 0;
  const queue = createPlaylistBatchQueue({
    filePath: path.join(dir, "batch.json"),
    finalizeStaleMs: 30,
    itemTimeoutMs: 400,
    pollIntervalMs: 15,
    ensureMusicAsset: async ({ url }) => {
      calls += 1;
      if (calls === 1) {
        return {
          jobId: url,
          persistent: false,
          poll: async () => ({ progress: 99, ready: false, onServer: false }),
        };
      }
      return { jobId: url, persistent: true, onServer: true, ready: true };
    },
    cancelJob: async () => {},
  });
  queue.enqueue({
    userKey: "u1",
    folderId: "f1",
    label: "Lista",
    tracks: [{ url: "https://music.apple.com/song/1", title: "A" }],
  });
  const deadline = Date.now() + 4000;
  let snap = queue.snapshot("u1");
  while (Date.now() < deadline) {
    snap = queue.snapshot("u1");
    if (snap?.completed === 1 || calls >= 2) break;
    await new Promise((r) => setTimeout(r, 20));
  }
  assert.ok(calls >= 2);
});

test("isolated plus does not merge into leftover playlist", async () => {
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
  const list = queue.enqueue({
    userKey: "u1",
    folderId: "f1",
    label: "Lista",
    tracks: [
      { url: "https://music.apple.com/song/1", title: "A" },
      { url: "https://music.apple.com/song/2", title: "B" },
    ],
  });
  const plus = queue.enqueue({
    userKey: "u1",
    folderId: "f1",
    label: "Waiting for Tonight",
    isolated: true,
    tracks: [{ url: "https://music.apple.com/song/tonight", title: "Waiting for Tonight" }],
  });
  assert.notEqual(list.batchId, plus.batchId);
  assert.equal(plus.queued, 1);
  const plusSnap = queue.snapshot("u1", plus.batchId);
  assert.equal(plusSnap.total, 1);
  assert.equal(plusSnap.currentTitle, "Waiting for Tonight");
  await queue.cancel({ userKey: "u1", batchId: list.batchId });
  await queue.cancel({ userKey: "u1", batchId: plus.batchId });
});

test("empty token register does not notify leftover playlist", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-batch-"));
  const notified = [];
  const queue = createPlaylistBatchQueue({
    filePath: path.join(dir, "batch.json"),
    ensureMusicAsset: async ({ url }) => ({ jobId: url, persistent: false, poll: async () => ({ progress: 10 }) }),
    cancelJob: async () => {},
    onNotify: (batch) => notified.push(batch.id),
  });
  const list = queue.enqueue({
    userKey: "u1",
    folderId: "f1",
    label: "Lista",
    tracks: [{ url: "https://music.apple.com/song/1", title: "A" }],
  });
  notified.length = 0;
  queue.registerToken({ userKey: "u1", token: "abc", activityId: "act", batchId: "" });
  assert.equal(notified.includes(list.batchId), false);
  queue.registerToken({ userKey: "u1", token: "abc", activityId: "act", batchId: list.batchId });
  assert.equal(notified.includes(list.batchId), true);
  await queue.cancel({ userKey: "u1", batchId: list.batchId });
});

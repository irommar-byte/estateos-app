import test from "node:test";
import assert from "node:assert/strict";

import { isStalledMusicAcquire, failStalledMusicAcquire } from "../music-assets.js";

test("persisting Apple Music job at 22% is stalled after boot idle", () => {
  const now = 1_000_000;
  const job = {
    kind: "music",
    status: "downloading",
    persisting: true,
    progress: 22,
    queuedAt: now - 40_000,
    lastProgressAt: now - 40_000,
    ready: false,
  };
  assert.equal(isStalledMusicAcquire(job, now), true);
});

test("healthy persisting job with fresh progress is not stalled", () => {
  const now = 1_000_000;
  const job = {
    kind: "music",
    status: "downloading",
    persisting: true,
    progress: 55,
    queuedAt: now - 20_000,
    lastProgressAt: now - 5_000,
    ready: false,
  };
  assert.equal(isStalledMusicAcquire(job, now), false);
});

test("failing a stalled ingest kills the child and marks error", () => {
  const now = Date.now();
  const killed = [];
  const job = {
    id: "job-1",
    kind: "music",
    status: "downloading",
    persisting: true,
    progress: 22,
    queuedAt: now - 60_000,
    lastProgressAt: now - 60_000,
    ready: false,
    proc: { kill: (sig) => killed.push(sig) },
  };
  assert.equal(failStalledMusicAcquire(job), true);
  assert.equal(job.status, "error");
  assert.equal(job.cancelled, true);
  assert.equal(job.persisting, false);
  assert.deepEqual(killed, ["SIGKILL"]);
});

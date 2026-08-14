import test from "node:test";
import assert from "node:assert/strict";

import { noteJobProgress, markJobListed } from "../download-queue.js";
import { normalizeMovieUrlKey } from "../movies-library.js";

test("normalizes equivalent episode URLs for deduplication", () => {
  assert.equal(
    normalizeMovieUrlKey("http://www.example.com/Series/Episode-online/?token=old#player"),
    normalizeMovieUrlKey("https://example.com/series/episode")
  );
});

test("tracks real progress heartbeats and explicit phases", () => {
  const job = { status: "starting", progress: 0 };
  markJobListed(job, { kind: "movie", title: "Episode", url: "https://example.com/e" });
  const queuedAt = job.lastProgressAt;
  noteJobProgress(job, { status: "processing", progress: 12, phase: "transcoding" });
  assert.equal(job.phase, "transcoding");
  assert.equal(job.progress, 12);
  assert.ok(job.lastProgressAt >= queuedAt);
  assert.equal(job.finishedAt, undefined);
});

test("marks terminal jobs ready only on terminal event", () => {
  const job = { status: "processing", progress: 99 };
  noteJobProgress(job, { status: "done", progress: 100, ready: true });
  assert.equal(job.phase, "ready");
  assert.equal(job.ready, true);
  assert.equal(job.progress, 100);
  assert.ok(job.finishedAt > 0);
});

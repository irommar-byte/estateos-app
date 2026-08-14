import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { DurableMovieJobQueue } from "../movie-job-queue.js";

const waitFor = async (predicate, timeoutMs = 1500) => {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("condition timed out");
};

test("caps whole-job concurrency until terminal completion", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-movie-queue-"));
  const started = [];
  const queue = new DurableMovieJobQueue({
    filePath: path.join(dir, "queue.json"),
    maxConcurrent: 2,
    runner: async (record) => { started.push(record.id); },
  });
  for (const id of ["a", "b", "c"]) queue.enqueue({ id, payload: { sourceUrl: id } });
  await waitFor(() => started.length === 2);
  assert.deepEqual(started, ["a", "b"]);
  assert.equal(queue.runningCount(), 2);
  queue.complete("a");
  await waitFor(() => started.length === 3);
  assert.equal(started[2], "c");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("restores interrupted running records as queued after restart", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-movie-restore-"));
  const filePath = path.join(dir, "queue.json");
  const first = new DurableMovieJobQueue({ filePath, maxConcurrent: 1, runner: async () => {} });
  first.enqueue({ id: "episode", payload: { sourceUrl: "https://example.com/episode" } });
  await waitFor(() => first.runningCount() === 1);

  const restoredStarts = [];
  const restored = new DurableMovieJobQueue({
    filePath, maxConcurrent: 1, runner: async (record) => { restoredStarts.push(record.id); },
  });
  assert.equal(restored.get("episode").state, "queued");
  restored.start();
  await waitFor(() => restoredStarts.length === 1);
  assert.deepEqual(restoredStarts, ["episode"]);
  fs.rmSync(dir, { recursive: true, force: true });
});


test("persistence failure never starts a non-durable transfer", async () => {
  let started = false;
  const errors = [];
  const queue = new DurableMovieJobQueue({
    filePath: "/dev/null/movie-queue.json",
    runner: async () => { started = true; },
    onPersistError: (error) => errors.push(error),
  });
  assert.throws(() => queue.enqueue({ id: "unsafe", payload: { sourceUrl: "x" } }));
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(started, false);
  assert.equal(queue.get("unsafe"), null);
  assert.ok(errors.length >= 1);
});

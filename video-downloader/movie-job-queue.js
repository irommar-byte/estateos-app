import fs from "node:fs";
import path from "node:path";

/**
 * Durable admission queue. A record remains `running` until the owner calls complete/cancel,
 * so the concurrency cap covers the whole download rather than only process startup.
 */
export class DurableMovieJobQueue {
  constructor({ filePath, maxConcurrent = 2, runner, onError = null, onPersistError = null }) {
    if (!filePath) throw new Error("DurableMovieJobQueue requires filePath");
    if (typeof runner !== "function") throw new Error("DurableMovieJobQueue requires runner");
    this.filePath = filePath;
    this.maxConcurrent = Math.max(1, Number(maxConcurrent) || 2);
    this.runner = runner;
    this.onError = onError;
    this.onPersistError = onPersistError;
    this.lastPersistError = null;
    this.records = new Map();
    this.pumping = false;
    this.load();
  }

  load() {
    let parsed = [];
    try {
      parsed = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
    } catch {}
    for (const raw of Array.isArray(parsed) ? parsed : []) {
      if (!raw?.id || !raw?.payload) continue;
      this.records.set(raw.id, {
        ...raw,
        state: "queued", // an interrupted process must be reconstructed after restart
        restored: raw.state === "running" || raw.restored === true,
      });
    }
    this.persist();
  }

  list() {
    return [...this.records.values()].sort((a, b) => (a.enqueuedAt || 0) - (b.enqueuedAt || 0));
  }

  get(id) {
    return this.records.get(id) || null;
  }

  enqueue(record) {
    if (!record?.id || !record?.payload) throw new Error("Invalid durable movie queue record");
    const existing = this.records.get(record.id);
    if (existing) return existing;
    const next = {
      ...record,
      state: "queued",
      enqueuedAt: Number(record.enqueuedAt) || Date.now(),
      attempts: Number(record.attempts) || 0,
    };
    this.records.set(next.id, next);
    if (!this.persist()) {
      this.records.delete(next.id);
      throw this.lastPersistError || new Error("Nie udało się zapisać kolejki pobierania.");
    }
    this.pump();
    return next;
  }

  complete(id) {
    if (!this.records.delete(id)) return false;
    this.persist();
    this.pump();
    return true;
  }

  cancel(id) {
    return this.complete(id);
  }

  start() {
    this.pump();
  }

  async pump() {
    if (this.pumping) return;
    this.pumping = true;
    try {
      while (this.runningCount() < this.maxConcurrent) {
        const record = this.list().find((item) => item.state === "queued");
        if (!record) break;
        record.state = "running";
        record.startedAt = Date.now();
        record.attempts = (Number(record.attempts) || 0) + 1;
        this.records.set(record.id, record);
        if (!this.persist()) {
          record.state = "queued";
          this.records.set(record.id, record);
          break;
        }
        Promise.resolve()
          .then(() => this.runner(record))
          .catch((error) => {
            this.complete(record.id);
            this.onError?.(record, error);
          });
      }
    } finally {
      this.pumping = false;
    }
  }

  runningCount() {
    let count = 0;
    for (const record of this.records.values()) {
      if (record.state === "running") count += 1;
    }
    return count;
  }

  persist() {
    const temp = `${this.filePath}.tmp`;
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(temp, JSON.stringify(this.list(), null, 2) + "\n");
      fs.renameSync(temp, this.filePath);
      this.lastPersistError = null;
      return true;
    } catch (error) {
      this.lastPersistError = error;
      try { fs.rmSync(temp, { force: true }); } catch {}
      this.onPersistError?.(error);
      return false;
    }
  }
}

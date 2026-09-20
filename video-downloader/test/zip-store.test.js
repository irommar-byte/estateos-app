import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PassThrough } from "node:stream";
import { uniqueZipEntryNames, streamZipStore } from "../zip-store.js";

test("uniqueZipEntryNames keeps first name and suffixes clashes", () => {
  assert.deepEqual(uniqueZipEntryNames(["a.mp3", "a.mp3", "b.mp3"]), ["a.mp3", "a (2).mp3", "b.mp3"]);
});

test("streamZipStore writes a zipfile-readable archive", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eos-zip-"));
  const a = path.join(dir, "one.mp3");
  const b = path.join(dir, "two.mp3");
  fs.writeFileSync(a, "hello-zip-a");
  fs.writeFileSync(b, "hello-zip-b");
  const zipPath = path.join(dir, "out.zip");
  const chunks = [];
  const dest = new PassThrough();
  dest.on("data", (c) => chunks.push(c));
  await streamZipStore(dest, [
    { name: "The Weeknd/Album/one.mp3", filePath: a },
    { name: "../two.mp3", filePath: b },
  ]);
  fs.writeFileSync(zipPath, Buffer.concat(chunks));
  const script = path.join(dir, "check.py");
  fs.writeFileSync(
    script,
    "import zipfile, sys\n"
      + "z = zipfile.ZipFile(sys.argv[1])\n"
      + "assert z.testzip() is None\n"
      + "print('\\n'.join(z.namelist()))\n"
      + "print(z.read(z.namelist()[0]).decode())\n"
  );
  const py = spawnSync("python3", [script, zipPath], { encoding: "utf8" });
  assert.equal(py.status, 0, py.stderr || py.stdout);
  const lines = py.stdout.trim().split("\n");
  assert.equal(lines[0], "The Weeknd/Album/one.mp3");
  assert.equal(lines[1], "two.mp3");
  assert.equal(lines[2], "hello-zip-a");
  fs.rmSync(dir, { recursive: true, force: true });
});

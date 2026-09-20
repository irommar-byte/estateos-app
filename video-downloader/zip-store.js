/**
 * Stream a ZIP (store / no compression). MP3s barely compress, and this
 * avoids adding the `archiver` dependency on the NAS downloader.
 */
import fs from "node:fs";
import { createReadStream } from "node:fs";
import path from "node:path";
import { crc32 } from "node:zlib";

const LOCAL_SIG = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const CENTRAL_SIG = Buffer.from([0x50, 0x4b, 0x01, 0x02]);
const EOCD_SIG = Buffer.from([0x50, 0x4b, 0x05, 0x06]);

function u16(n) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n & 0xffff);
  return b;
}

function u32(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0);
  return b;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  return { dosDate, dosTime };
}

export function sanitizeZipEntryName(name) {
  const cleaned = String(name || "file")
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");
  return cleaned.slice(0, 180) || "file";
}

export function uniqueZipEntryNames(names) {
  const used = new Map();
  return names.map((raw) => {
    const sanitized = sanitizeZipEntryName(raw);
    const extMatch = sanitized.match(/(\.[A-Za-z0-9]{1,8})$/);
    const ext = extMatch ? extMatch[1] : "";
    const stem = ext ? sanitized.slice(0, -ext.length) : sanitized;
    const key0 = sanitized.toLowerCase();
    let n = used.get(key0) || 0;
    used.set(key0, n + 1);
    if (n === 0) return sanitized;
    let candidate;
    let i = n + 1;
    do {
      candidate = `${stem} (${i})${ext}`;
      i += 1;
    } while (used.has(candidate.toLowerCase()));
    used.set(candidate.toLowerCase(), 1);
    return candidate;
  });
}

function crc32File(filePath) {
  return new Promise((resolve, reject) => {
    let crc = 0;
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => {
      crc = crc32(chunk, crc);
    });
    stream.on("error", reject);
    stream.on("end", () => resolve(crc >>> 0));
  });
}

function writeChunk(dest, chunk) {
  return new Promise((resolve, reject) => {
    const onError = (err) => {
      dest.off?.("error", onError);
      reject(err);
    };
    dest.once("error", onError);
    if (dest.write(chunk)) {
      dest.off("error", onError);
      resolve();
      return;
    }
    dest.once("drain", () => {
      dest.off("error", onError);
      resolve();
    });
  });
}

function pipeFile(filePath, dest) {
  return new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("error", reject);
    stream.on("end", resolve);
    stream.pipe(dest, { end: false });
  });
}

/**
 * @param {import("node:stream").Writable} dest
 * @param {{ name: string, filePath: string }[]} files
 */
export async function streamZipStore(dest, files) {
  const existing = (files || []).filter((f) => f?.filePath && fs.existsSync(f.filePath));
  if (!existing.length) {
    throw new Error("Brak plików do spakowania.");
  }
  const names = uniqueZipEntryNames(existing.map((f) => f.name || path.basename(f.filePath)));
  const entries = [];
  let offset = 0;

  for (let i = 0; i < existing.length; i++) {
    const filePath = existing[i].filePath;
    const nameBuf = Buffer.from(names[i], "utf8");
    const stat = fs.statSync(filePath);
    const size = stat.size;
    if (size > 0xffffffff) {
      throw new Error("Plik jest za duży na ZIP bez ZIP64.");
    }
    const crc = await crc32File(filePath);
    const { dosDate, dosTime } = dosDateTime(stat.mtime);
    const localHeader = Buffer.concat([
      LOCAL_SIG,
      u16(20),
      u16(0),
      u16(0),
      u16(dosTime),
      u16(dosDate),
      u32(crc),
      u32(size),
      u32(size),
      u16(nameBuf.length),
      u16(0),
      nameBuf,
    ]);
    await writeChunk(dest, localHeader);
    await pipeFile(filePath, dest);
    entries.push({ nameBuf, crc, size, dosTime, dosDate, offset });
    offset += localHeader.length + size;
  }

  const cdStart = offset;
  for (const entry of entries) {
    const central = Buffer.concat([
      CENTRAL_SIG,
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(entry.dosTime),
      u16(entry.dosDate),
      u32(entry.crc),
      u32(entry.size),
      u32(entry.size),
      u16(entry.nameBuf.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(entry.offset),
      entry.nameBuf,
    ]);
    await writeChunk(dest, central);
    offset += central.length;
  }

  const eocd = Buffer.concat([
    EOCD_SIG,
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(offset - cdStart),
    u32(cdStart),
    u16(0),
  ]);
  await new Promise((resolve, reject) => {
    dest.end(eocd, (err) => (err ? reject(err) : resolve()));
  });
}

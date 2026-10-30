import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';

const run = promisify(execFile);

// Fixed identity: the client can't change who the pass claims to be from.
const PASS_TYPE_ID = 'pass.pl.paragonos.loyalty';
const TEAM_ID = 'NW3YW69KL9';
const ORGANIZATION = 'ParagonOS™';
const GROUPING_ID = 'pl.paragonos.app.loyalty';

export const PASS_IMAGE_NAMES = [
  'icon.png', 'icon@2x.png', 'icon@3x.png',
  'logo.png', 'logo@2x.png', 'logo@3x.png',
  'strip.png', 'strip@2x.png', 'strip@3x.png',
] as const;

const MAX_IMAGE_BYTES = 1_500_000;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const text = (max: number) => z.string().trim().max(max);

export const passRequestSchema = z.object({
  serialNumber: z.string().regex(/^[0-9A-Fa-f]{8}(-[0-9A-Fa-f]{4}){3}-[0-9A-Fa-f]{12}$/),
  description: text(64).min(1),
  memberNumber: text(64),
  holderName: text(64).optional().default(''),
  note: text(300).optional().default(''),
  barcodes: z
    .array(
      z.object({
        format: z.enum(['PKBarcodeFormatQR', 'PKBarcodeFormatPDF417', 'PKBarcodeFormatAztec', 'PKBarcodeFormatCode128']),
        message: z.string().min(1).max(128),
      }),
    )
    .min(1)
    .max(2),
  images: z.partialRecord(z.enum(PASS_IMAGE_NAMES), z.string().max(2_100_000)),
});

export type PassRequest = z.infer<typeof passRequestSchema>;

export class PassConfigError extends Error {}
export class PassInputError extends Error {}

function passJson(req: PassRequest): Buffer {
  const storeCard: Record<string, unknown> = {
    secondaryFields: [{ key: 'member', label: 'Numer', value: req.memberNumber || '—' }],
    backFields: [
      { key: 'note', label: ORGANIZATION, value: req.note || `Karta lojalnościowa z ${ORGANIZATION}.` },
    ],
  };
  if (req.holderName) {
    storeCard.auxiliaryFields = [{ key: 'holder', label: 'Właściciel', value: req.holderName }];
  }
  const pass = {
    formatVersion: 1,
    passTypeIdentifier: PASS_TYPE_ID,
    serialNumber: req.serialNumber,
    teamIdentifier: TEAM_ID,
    organizationName: ORGANIZATION,
    groupingIdentifier: GROUPING_ID,
    description: req.description,
    foregroundColor: 'rgb(29, 29, 31)',
    backgroundColor: 'rgb(255, 255, 255)',
    labelColor: 'rgb(134, 134, 139)',
    storeCard,
    barcodes: req.barcodes.map((b) => ({
      format: b.format,
      message: b.message,
      messageEncoding: 'iso-8859-1',
      altText: b.message,
    })),
  };
  return Buffer.from(JSON.stringify(pass, null, 2), 'utf8');
}

function decodeImages(images: PassRequest['images']): [string, Buffer][] {
  const out: [string, Buffer][] = [];
  for (const name of PASS_IMAGE_NAMES) {
    const b64 = images[name];
    if (!b64) {
      if (name === 'icon.png') throw new PassInputError('Brak icon.png.');
      continue;
    }
    const data = Buffer.from(b64, 'base64');
    if (data.length > MAX_IMAGE_BYTES || !data.subarray(0, 8).equals(PNG_MAGIC)) {
      throw new PassInputError(`Nieprawidłowy obraz: ${name}.`);
    }
    out.push([name, data]);
  }
  return out;
}

function signingFiles() {
  const cert = process.env.PARAGONOS_PASS_CERT_PATH || '';
  const key = process.env.PARAGONOS_PASS_KEY_PATH || '';
  const wwdr = process.env.PARAGONOS_PASS_WWDR_PATH || '';
  if (!cert || !key || !wwdr || ![cert, key, wwdr].every((p) => existsSync(p))) {
    throw new PassConfigError('Brak plików podpisu ParagonOS na serwerze.');
  }
  return { cert, key, wwdr };
}

async function signManifest(manifest: Buffer): Promise<Buffer> {
  const { cert, key, wwdr } = signingFiles();
  const dir = await mkdtemp(path.join(tmpdir(), 'paragonos-pass-'));
  try {
    const inFile = path.join(dir, 'manifest.json');
    const outFile = path.join(dir, 'signature');
    await writeFile(inFile, manifest);
    await run('openssl', [
      'smime', '-sign', '-binary', '-md', 'sha256',
      '-in', inFile, '-out', outFile, '-outform', 'DER',
      '-signer', cert, '-inkey', key, '-certfile', wwdr,
    ]);
    return await readFile(outFile);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function buildSignedPass(req: PassRequest): Promise<Buffer> {
  const files: [string, Buffer][] = [['pass.json', passJson(req)], ...decodeImages(req.images)];
  const manifestObject: Record<string, string> = {};
  for (const [name, data] of files) {
    manifestObject[name] = createHash('sha1').update(data).digest('hex');
  }
  const manifest = Buffer.from(JSON.stringify(manifestObject), 'utf8');
  const signature = await signManifest(manifest);
  return storeZip([...files, ['manifest.json', manifest], ['signature', signature]]);
}

// --- Minimal STORE (uncompressed) ZIP, enough for .pkpass ---

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function storeZip(files: [string, Buffer][]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, data] of files) {
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const centralSize = centrals.reduce((s, b) => s + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

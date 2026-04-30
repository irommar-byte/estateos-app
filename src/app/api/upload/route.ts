import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { getWebFormData } from '@/lib/requestFormData';

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const MAX_OFFER_STORAGE = 20 * 1024 * 1024;
const MAX_IMAGES_PER_OFFER = 20;

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};

const BASE_UPLOAD_DIR = '/home/rommar/uploads/offers';

const activeUploads = new Set<number>();
async function acquireLock(offerId: number) {
  while (activeUploads.has(offerId)) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  activeUploads.add(offerId);
}
function releaseLock(offerId: number) {
  activeUploads.delete(offerId);
}

const requestMap = new Map<string, { count: number; last: number }>();
const RATE_LIMIT = 15;
const RATE_WINDOW = 10_000;
let lastSweep = Date.now();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  if (now - lastSweep > RATE_WINDOW) {
    for (const [key, val] of requestMap.entries()) {
      if (now - val.last > RATE_WINDOW) requestMap.delete(key);
    }
    lastSweep = now;
  }
  const entry = requestMap.get(ip) || { count: 0, last: now };
  if (now - entry.last > RATE_WINDOW) {
    entry.count = 0;
    entry.last = now;
  }
  entry.count++;
  requestMap.set(ip, entry);
  return entry.count <= RATE_LIMIT;
}

async function getFolderSize(folderPath: string): Promise<number> {
  try {
    const files = await fs.readdir(folderPath);
    let total = 0;
    const stats = await Promise.all(
      files.map(f => fs.stat(path.join(folderPath, f)).catch(() => null))
    );
    for (const s of stats) {
      if (s && s.isFile()) total += s.size;
    }
    return total;
  } catch {
    return 0; 
  }
}

function isValidImage(buffer: Buffer, mime: string): boolean {
  if (buffer.length < 12) return false;
  if (mime === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8;
  if (mime === 'image/png') return buffer.slice(0, 8).toString('hex') === '89504e470d0a1a0a';
  if (mime === 'image/webp') return buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP';
  return false;
}

// 🔥 INTELIGENTNA KOMPRESJA + LUKSUSOWY ZNAK WODNY EstateOS™ 🔥
async function processImage(buffer: Buffer, fallbackExt: string, fileSize: number): Promise<{ buffer: Buffer; ext: string }> {
  try {
    const sharp = require("sharp");
    let image = sharp(buffer).rotate();

    const svgWatermark = `
      <svg width="450" height="350" xmlns="http://www.w3.org/2000/svg">
        <text x="50%" y="50%" text-anchor="middle" alignment-baseline="middle"
              font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="52"
              fill="rgba(255, 255, 255, 0.35)"
              stroke="rgba(0, 0, 0, 0.15)" stroke-width="2"
              transform="rotate(-25 225 175)">
          EstateOS™
        </text>
      </svg>
    `;

    const watermarkBuffer = await sharp(Buffer.from(svgWatermark))
      .png()
      .toBuffer();

    image = image.composite([{
      input: watermarkBuffer,
      tile: true,
      blend: 'over'
    }]);

    const finalBuffer = await image.webp({ quality: 92 }).toBuffer();
    return { buffer: finalBuffer, ext: ".webp" };
  } catch (e) {
    console.error("❌ Błąd przetwarzania obrazu:", e);
    return { buffer, ext: fallbackExt };
  }
}

function getUserIdFromToken(authHeader: string): number | null {
  try {
    const token = authHeader.split(' ')[1];
    if (!process.env.JWT_SECRET) return null;
    const payload = jwt.verify(token, process.env.JWT_SECRET) as any;
    return payload?.id || payload?.sub || null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';

  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Zbyt wiele zapytań naraz.' }, { status: 429 });
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Brak autoryzacji.' }, { status: 401 });
  }

  const userId = getUserIdFromToken(authHeader);
  if (!userId) {
    return NextResponse.json({ error: 'Twoja sesja wygasła.' }, { status: 401 });
  }

  let formData;
  try {
    formData = await getWebFormData(req);
  } catch {
    return NextResponse.json({ error: 'Błąd formularza.' }, { status: 400 });
  }

  const file = formData.get('file') as File;
  const offerIdStr = formData.get('offerId') as string;
  const isFloorPlan = formData.get('isFloorPlan') as string;

  if (!file || !offerIdStr) return NextResponse.json({ error: 'Brak pliku.' }, { status: 400 });

  const offerId = Number(offerIdStr);
  if (isNaN(offerId)) return NextResponse.json({ error: 'Błędne ID.' }, { status: 400 });

  if (!ALLOWED_MIME_TYPES.includes(file.type)) return NextResponse.json({ error: 'Niedozwolony format pliku.' }, { status: 415 });
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'Plik jest za duży.' }, { status: 413 });

  const offerCheck = await prisma.offer.findUnique({ where: { id: offerId }, select: { userId: true } });
  if (!offerCheck) return NextResponse.json({ error: "Nie znaleziono oferty." }, { status: 404 });
  if (offerCheck.userId !== userId) return NextResponse.json({ error: "Brak uprawnień." }, { status: 403 });

  await acquireLock(offerId);

  try {
    const offer = await prisma.offer.findUnique({ where: { id: offerId }, select: { images: true, floorPlanUrl: true } });
    if (!offer) return NextResponse.json({ error: 'Oferta usunięta.' }, { status: 404 });

    const bytes = await file.arrayBuffer();
    const originalBuffer = Buffer.from(bytes);
    if (!isValidImage(originalBuffer, file.type)) return NextResponse.json({ error: 'Plik uszkodzony.' }, { status: 400 });

    const fallbackExt = MIME_TO_EXT[file.type] || '.jpg';
    const { buffer: finalBuffer, ext: finalExt } = await processImage(originalBuffer, fallbackExt, file.size);

    const offerDir = path.join(BASE_UPLOAD_DIR, String(offerId));
    try { await fs.access(offerDir); } catch { await fs.mkdir(offerDir, { recursive: true }); }

    const currentOfferDirSize = await getFolderSize(offerDir);
    if (currentOfferDirSize + finalBuffer.length > MAX_OFFER_STORAGE) {
        return NextResponse.json({ error: 'Brak miejsca dla tej oferty.' }, { status: 400 });
    }

    let existingImages: string[] = [];
    try { existingImages = offer.images ? JSON.parse(offer.images) : []; } catch {}
    if (isFloorPlan !== 'true' && existingImages.length >= MAX_IMAGES_PER_OFFER) {
      return NextResponse.json({ error: 'Osiągnięto limit zdjęć.' }, { status: 400 });
    }

    const fileName = crypto.randomUUID() + finalExt;
    const filePath = path.join(offerDir, fileName);
    await fs.writeFile(filePath, finalBuffer);
    const publicUrl = `/uploads/offers/${offerId}/${fileName}`;

    if (isFloorPlan === 'true') {
      await prisma.offer.update({ where: { id: offerId }, data: { floorPlanUrl: publicUrl } });
    } else {
      existingImages.push(publicUrl);
      await prisma.offer.update({ where: { id: offerId }, data: { images: JSON.stringify(existingImages) } });
    }

    return NextResponse.json({ url: publicUrl });

  } catch (e) {
    console.error('❌ UPLOAD ERROR:', e);
    return NextResponse.json({ error: 'Błąd serwera.' }, { status: 500 });
  } finally {
    releaseLock(offerId);
  }
}

import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { loadOfferShareCard } from '@/lib/offerShareLanding';
import { loadCarShareMeta } from '@/lib/carShareLanding';
import { OG_CARD_VERSION, carOgImagePath, offerOgImagePath } from '@/lib/ogCardVersion';

export { OG_CARD_VERSION, carOgImagePath, offerOgImagePath };

function resolvePublicAppOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://estateos.pl').replace(
    /\/+$/,
    '',
  );
}

function cacheDir(): string {
  return path.join(process.cwd(), 'public', 'uploads', 'og-cache');
}

function escapeXml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function truncate(value: string, max: number): string {
  const s = String(value || '').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1))}…`;
}

async function readLocalUploadBuffer(url: string): Promise<Buffer | null> {
  const origin = resolvePublicAppOrigin();
  let pathname = '';
  try {
    const u = new URL(url);
    if (u.origin !== origin && !url.includes('estateos.pl')) return null;
    pathname = u.pathname;
  } catch {
    if (url.startsWith('/uploads/')) pathname = url;
    else return null;
  }
  if (!pathname.startsWith('/uploads/')) return null;

  const candidates = [
    path.join(process.cwd(), 'public', pathname.replace(/^\//, '')),
    path.join(process.cwd(), pathname.replace(/^\//, '')),
    path.join(process.env.HOME || '', 'estateos', 'public', pathname.replace(/^\//, '')),
  ];

  for (const candidate of candidates) {
    try {
      const buf = await fs.readFile(candidate);
      if (buf.length) return buf;
    } catch {
      /* next */
    }
  }
  return null;
}

async function loadPhotoBuffer(url: string): Promise<Buffer | null> {
  const raw = String(url || '').trim();
  if (!raw) return null;
  const local = await readLocalUploadBuffer(raw);
  if (local) return local;
  try {
    const res = await fetch(raw, {
      headers: { Accept: 'image/*,*/*', 'User-Agent': 'EstateOS-OG/1.0' },
      cache: 'force-cache',
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length ? buf : null;
  } catch {
    return null;
  }
}

type OverlayTheme = {
  brand: string;
  eyebrow: string;
  accent: string;
  accentSoft: string;
  accentLine: string;
  chipFill: string;
  chipStroke: string;
  chipText: string;
  priceFill: string;
  priceStroke: string;
  priceLabel: string;
  priceValue: string;
  panelFill: string;
};

const REALTY_THEME: OverlayTheme = {
  brand: 'ESTATEOS™',
  eyebrow: 'OFERTA PREMIUM',
  accent: '#0f3d34',
  accentSoft: '#1a5c4f',
  accentLine: '#c4a574',
  chipFill: 'rgba(15, 61, 52, 0.08)',
  chipStroke: 'rgba(196, 165, 116, 0.55)',
  chipText: '#0f3d34',
  priceFill: '#0f3d34',
  priceStroke: '#c4a574',
  priceLabel: '#e8d5b5',
  priceValue: '#ffffff',
  panelFill: 'rgba(255, 252, 248, 0.96)',
};

const CAR_THEME: OverlayTheme = {
  brand: 'ESTATEOS™ CAR',
  eyebrow: 'OFERTA PREMIUM',
  accent: '#0c1e33',
  accentSoft: '#163a5f',
  accentLine: '#b8a07a',
  chipFill: 'rgba(12, 30, 51, 0.08)',
  chipStroke: 'rgba(184, 160, 122, 0.55)',
  chipText: '#0c1e33',
  priceFill: '#0c1e33',
  priceStroke: '#b8a07a',
  priceLabel: '#e4d4b8',
  priceValue: '#ffffff',
  panelFill: 'rgba(255, 252, 248, 0.96)',
};

function buildChipRow(chips: string[], theme: OverlayTheme): string {
  const usable = chips.map((c) => truncate(c, 22)).filter(Boolean).slice(0, 4);
  if (!usable.length) return '';
  let x = 56;
  const y = 558;
  const parts: string[] = [];
  for (const label of usable) {
    const w = Math.min(220, Math.max(76, 16 + label.length * 9.4));
    if (x + w > 820) break;
    parts.push(`
  <rect x="${x}" y="${y}" width="${w}" height="28" rx="14" fill="rgba(8,10,12,0.42)" stroke="${theme.accentLine}" stroke-opacity="0.55" stroke-width="1"/>
  <text x="${x + w / 2}" y="${y + 19}" text-anchor="middle" font-family="DejaVu Sans, Liberation Sans, Arial, Helvetica, sans-serif" font-size="13" font-weight="400" letter-spacing="0.8" fill="#f7f1e8">${escapeXml(label)}</text>`);
    x += w + 10;
  }
  return parts.join('');
}

function buildOverlaySvg(params: {
  theme: OverlayTheme;
  title: string;
  location: string;
  chips: string[];
  price: string;
}): Buffer {
  const theme = params.theme;
  const title = escapeXml(truncate(params.title, 44));
  const location = escapeXml(truncate(params.location, 48));
  const price = escapeXml(truncate(params.price, 22));
  const brand = escapeXml(theme.brand);
  const chipsSvg = buildChipRow(params.chips, theme);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="wash" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#05070a" stop-opacity="0.18"/>
      <stop offset="48%" stop-color="#05070a" stop-opacity="0.04"/>
      <stop offset="72%" stop-color="#05070a" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#05070a" stop-opacity="0.72"/>
    </linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="3.5" flood-color="#000000" flood-opacity="0.45"/>
    </filter>
  </defs>

  <rect width="1200" height="630" fill="url(#wash)"/>
  <rect x="28" y="28" width="1144" height="574" rx="2" fill="none" stroke="${theme.accentLine}" stroke-opacity="0.42" stroke-width="1"/>
  <rect x="34" y="34" width="1132" height="562" rx="1" fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-width="0.8"/>

  <rect x="48" y="46" width="268" height="40" rx="20" fill="rgba(8,10,12,0.38)" stroke="${theme.accentLine}" stroke-opacity="0.45" stroke-width="1"/>
  <rect x="60" y="58" width="2" height="16" rx="1" fill="${theme.accentLine}"/>
  <text x="74" y="72" font-family="DejaVu Sans, Liberation Sans, Arial, Helvetica, sans-serif" font-size="15" font-weight="400" letter-spacing="5.2" fill="#f4efe6" filter="url(#soft)">${brand}</text>

  <text x="56" y="478" font-family="DejaVu Sans, Liberation Sans, Arial, Helvetica, sans-serif" font-size="12" font-weight="400" letter-spacing="4.4" fill="${theme.accentLine}" filter="url(#soft)">${escapeXml(theme.eyebrow)}</text>
  <text x="56" y="516" font-family="DejaVu Sans, Liberation Sans, Arial, Helvetica, sans-serif" font-size="32" font-weight="400" letter-spacing="0.4" fill="#fffdf8" filter="url(#soft)">${title}</text>
  <text x="56" y="544" font-family="DejaVu Sans, Liberation Sans, Arial, Helvetica, sans-serif" font-size="16" font-weight="400" letter-spacing="0.6" fill="#e8e0d2" filter="url(#soft)">${location}</text>
  ${chipsSvg}
  <text x="56" y="598" font-family="DejaVu Sans, Liberation Sans, Arial, Helvetica, sans-serif" font-size="12" font-weight="400" letter-spacing="2.4" fill="#d8cbb6">estateos.pl</text>

  ${
    price
      ? `<text x="1144" y="500" text-anchor="end" font-family="DejaVu Sans, Liberation Sans, Arial, Helvetica, sans-serif" font-size="11" font-weight="400" letter-spacing="4.8" fill="${theme.accentLine}" filter="url(#soft)">CENA</text>
  <text x="1144" y="546" text-anchor="end" font-family="DejaVu Sans, Liberation Sans, Arial, Helvetica, sans-serif" font-size="36" font-weight="400" letter-spacing="0.6" fill="#fffdf8" filter="url(#soft)">${price}</text>
  <line x1="980" y1="562" x2="1144" y2="562" stroke="${theme.accentLine}" stroke-width="1" stroke-opacity="0.85"/>`
      : ''
  }
</svg>`;

  return Buffer.from(svg);
}

async function composeOgJpeg(photoUrl: string, overlay: Buffer, fallbackHex: string): Promise<Buffer> {
  const photo = await loadPhotoBuffer(photoUrl);
  let base: sharp.Sharp;
  if (photo) {
    base = sharp(photo).rotate().resize(1200, 630, { fit: 'cover', position: 'attention' });
  } else {
    base = sharp({
      create: {
        width: 1200,
        height: 630,
        channels: 3,
        background: fallbackHex,
      },
    });
  }

  return base
    .composite([{ input: overlay, top: 0, left: 0 }])
    .jpeg({ quality: 84, mozjpeg: true, chromaSubsampling: '4:2:0' })
    .toBuffer();
}

async function readCache(filePath: string): Promise<Buffer | null> {
  try {
    const buf = await fs.readFile(filePath);
    return buf.length > 1000 ? buf : null;
  } catch {
    return null;
  }
}

async function writeCache(filePath: string, buf: Buffer): Promise<void> {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buf);
  } catch {
    /* non-fatal */
  }
}

export function offerOgPublicUrl(offerId: number): string {
  return `${resolvePublicAppOrigin()}${offerOgImagePath(offerId)}`;
}

export function carOgPublicUrl(carId: number): string {
  return `${resolvePublicAppOrigin()}${carOgImagePath(carId)}`;
}

export async function getOfferOgJpeg(offerId: number): Promise<Buffer | null> {
  if (!Number.isFinite(offerId) || offerId <= 0) return null;
  const filePath = path.join(cacheDir(), `offer-${offerId}-${OG_CARD_VERSION}.jpg`);
  const cached = await readCache(filePath);
  if (cached) return cached;

  const card = await loadOfferShareCard(offerId);
  if (!card) return null;

  const chips = [card.propertyTypeLabel, card.transactionLabel];
  if (card.area != null && card.area > 0) chips.push(`${card.area} m²`);
  if (card.rooms != null && card.rooms > 0) chips.push(`${card.rooms} pok.`);

  const overlay = buildOverlaySvg({
    theme: REALTY_THEME,
    title: card.title,
    location: card.locationLabel,
    chips,
    price: card.priceLabel,
  });

  const jpeg = await composeOgJpeg(card.imageUrl, overlay, '#1a2e28');
  await writeCache(filePath, jpeg);
  return jpeg;
}

export async function getCarOgJpeg(carId: number): Promise<Buffer | null> {
  if (!Number.isFinite(carId) || carId <= 0) return null;
  const filePath = path.join(cacheDir(), `car-${carId}-${OG_CARD_VERSION}.jpg`);
  const cached = await readCache(filePath);
  if (cached) return cached;

  const meta = await loadCarShareMeta(carId);
  if (!meta) return null;

  const overlay = buildOverlaySvg({
    theme: CAR_THEME,
    title: meta.title,
    location: meta.locationLabel,
    chips: meta.chips.length ? meta.chips : ['Samochód', 'Sprzedaż'],
    price: meta.priceLabel,
  });

  const jpeg = await composeOgJpeg(meta.photoUrl, overlay, '#0c1e33');
  await writeCache(filePath, jpeg);
  return jpeg;
}

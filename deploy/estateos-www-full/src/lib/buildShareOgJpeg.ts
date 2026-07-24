import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { loadOfferShareCard } from '@/lib/offerShareLanding';
import { loadCarShareMeta } from '@/lib/carShareLanding';

/** Bump when layout/copy of OG card changes — busts FB + disk cache. */
export const OG_CARD_VERSION = 'v6';

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
  const usable = chips.map((c) => truncate(c, 28)).filter(Boolean).slice(0, 4);
  if (!usable.length) return '';
  let x = 64;
  const y = 508;
  const parts: string[] = [];
  for (const label of usable) {
    const w = Math.min(280, Math.max(88, 18 + label.length * 11));
    if (x + w > 820) break;
    parts.push(`
  <rect x="${x}" y="${y}" width="${w}" height="34" rx="8" fill="${theme.chipFill}" stroke="${theme.chipStroke}" stroke-width="1.2"/>
  <text x="${x + w / 2}" y="${y + 23}" text-anchor="middle" font-family="DejaVu Sans, Liberation Sans, Arial, Helvetica, sans-serif" font-size="15" font-weight="600" fill="${theme.chipText}">${escapeXml(label)}</text>`);
    x += w + 12;
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
  const title = escapeXml(truncate(params.title, 52));
  const location = escapeXml(truncate(params.location, 48));
  const price = escapeXml(truncate(params.price, 22));
  const brand = escapeXml(theme.brand);
  const chipsSvg = buildChipRow(params.chips, theme);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="wash" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0a0a0a" stop-opacity="0.12"/>
      <stop offset="42%" stop-color="#0a0a0a" stop-opacity="0.05"/>
      <stop offset="78%" stop-color="#0a0a0a" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#0a0a0a" stop-opacity="0.62"/>
    </linearGradient>
    <linearGradient id="panelGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fffdf9" stop-opacity="0.98"/>
      <stop offset="100%" stop-color="#f7f1e8" stop-opacity="0.97"/>
    </linearGradient>
  </defs>

  <!-- Outer frame -->
  <rect x="22" y="22" width="1156" height="586" rx="4" fill="none" stroke="${theme.accentLine}" stroke-opacity="0.55" stroke-width="1.5"/>
  <rect x="30" y="30" width="1140" height="570" rx="2" fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1"/>

  <rect width="1200" height="630" fill="url(#wash)"/>

  <!-- Top brand ribbon -->
  <rect x="48" y="48" width="320" height="52" rx="4" fill="rgba(10,10,10,0.55)"/>
  <rect x="48" y="48" width="4" height="52" fill="${theme.accentLine}"/>
  <text x="68" y="80" font-family="DejaVu Sans, Liberation Sans, Arial, Helvetica, sans-serif" font-size="18" font-weight="700" letter-spacing="4.5" fill="#f5f0e6">${brand}</text>

  <!-- Bottom editorial panel -->
  <rect x="40" y="378" width="1120" height="212" rx="6" fill="url(#panelGrad)"/>
  <rect x="40" y="378" width="1120" height="3" fill="${theme.accentLine}"/>
  <rect x="40" y="381" width="1120" height="1" fill="${theme.accent}" fill-opacity="0.15"/>

  <text x="64" y="418" font-family="DejaVu Sans, Liberation Sans, Arial, Helvetica, sans-serif" font-size="13" font-weight="700" letter-spacing="3.8" fill="${theme.accentSoft}">${escapeXml(theme.eyebrow)}</text>
  <text x="64" y="462" font-family="DejaVu Sans, Liberation Sans, Arial, Helvetica, sans-serif" font-size="34" font-weight="700" fill="#14110e">${title}</text>
  <text x="64" y="496" font-family="DejaVu Sans, Liberation Sans, Arial, Helvetica, sans-serif" font-size="20" font-weight="600" fill="#5c5348">${location}</text>
  ${chipsSvg}
  <text x="64" y="572" font-family="DejaVu Sans, Liberation Sans, Arial, Helvetica, sans-serif" font-size="14" font-weight="600" letter-spacing="1.2" fill="#8a7f70">estateos.pl</text>

  ${
    price
      ? `<rect x="852" y="430" width="284" height="118" rx="6" fill="${theme.priceFill}" stroke="${theme.priceStroke}" stroke-width="2"/>
  <rect x="860" y="438" width="268" height="102" rx="3" fill="none" stroke="${theme.priceStroke}" stroke-opacity="0.35" stroke-width="1"/>
  <text x="994" y="474" text-anchor="middle" font-family="DejaVu Sans, Liberation Sans, Arial, Helvetica, sans-serif" font-size="13" font-weight="700" letter-spacing="3" fill="${theme.priceLabel}">CENA</text>
  <text x="994" y="522" text-anchor="middle" font-family="DejaVu Sans, Liberation Sans, Arial, Helvetica, sans-serif" font-size="28" font-weight="700" fill="${theme.priceValue}">${price}</text>`
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
  return `${resolvePublicAppOrigin()}/api/og/offer/${offerId}?${OG_CARD_VERSION}`;
}

export function carOgPublicUrl(carId: number): string {
  return `${resolvePublicAppOrigin()}/api/og/car/${carId}?${OG_CARD_VERSION}`;
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

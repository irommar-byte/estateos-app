import type { MarketComp, ValuationResult, ValuationSubject } from '@/lib/market/types';

const MAP_W = 800;
const MAP_H = 480;
const OSM_TILE = 256;
const OSM_GRID = 3;

function esc(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fold(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ß/g, 'ss');
}

/** Street stem for „ta sama ulica” — ignores ul./al. and the building number. */
export function streetStem(address?: string | null): string {
  if (!address) return '';
  let s = fold(String(address));
  s = s.replace(/\b(ulica|ul|aleja|aleje|al|plac|pl|osiedle|os|rondo|skwer)\.?\s+/g, ' ');
  s = s.replace(/[0-9].*$/, ' ');
  s = s.replace(/[^a-z\- ]+/g, ' ').replace(/\s+/g, ' ').trim();
  return s.slice(0, 48);
}

export function formatMarketType(raw?: string | null): string {
  const s = fold(String(raw || ''));
  if (!s) return '—';
  if (s.includes('pierw')) return 'pierwotny';
  if (s.includes('wtor')) return 'wtórny';
  return String(raw);
}

function formatDistance(m: number) {
  if (!Number.isFinite(m) || m < 0) return '—';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

function mapboxToken() {
  return String(process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '').trim();
}

function skipStreetMapFetch() {
  return Boolean(process.env.NODE_TEST_CONTEXT) || process.env.ESTATEOS_SKIP_MAP_FETCH === '1';
}

function realCoord(comp: Pick<MarketComp, 'lat' | 'lng'>): { lat: number; lng: number } | null {
  if (
    comp.lat == null ||
    comp.lng == null ||
    !Number.isFinite(comp.lat) ||
    !Number.isFinite(comp.lng) ||
    Math.abs(comp.lat) > 90 ||
    Math.abs(comp.lng) > 180
  ) {
    return null;
  }
  return { lat: comp.lat, lng: comp.lng };
}

export type MappedComp = MarketComp & {
  sameStreet: boolean;
  primary: boolean;
  index: number;
  geo: { lat: number; lng: number } | null;
};

export type CompsMapLayout = {
  subject: ValuationSubject;
  mapped: MappedComp[];
  radiusM: number;
  loc: string;
  coord: string;
};

export function layoutCompsMap(result: ValuationResult, numberedCount = 8): CompsMapLayout {
  const subject = result.subject;
  const comps = (result.comps || []).slice(0, Math.max(numberedCount, 8));
  const subjectStem = streetStem(subject.address);
  const radiusM = Math.max(200, result.stats.basis === 'comps' ? result.stats.radiusM || 800 : 800);
  const mapped: MappedComp[] = comps.map((c, i) => {
    const stem = streetStem(c.address);
    return {
      ...c,
      sameStreet: Boolean(subjectStem && stem && stem === subjectStem),
      primary: formatMarketType(c.marketType) === 'pierwotny',
      index: i + 1,
      geo: realCoord(c),
    };
  });
  return {
    subject,
    mapped,
    radiusM,
    loc: [subject.address, subject.district, subject.city].filter(Boolean).join(', '),
    coord: `${subject.lat.toFixed(5)}° N  ${subject.lng.toFixed(5)}° E`,
  };
}

function metersBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const dLat = (a.lat - b.lat) * 110_540;
  const dLng = (a.lng - b.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

function plotOnStreetMap(c: MappedComp, subject: ValuationSubject) {
  if (!c.geo || c.index > 8) return false;
  return metersBetween(c.geo, subject) >= 28;
}

function pinColorHex(c: MappedComp) {
  if (c.primary) return 'c2410c';
  if (c.sameStreet) return '0f766e';
  return '1f2937';
}

function pinFill(c: MappedComp) {
  if (c.primary) return '#c2410c';
  if (c.sameStreet) return '#0f766e';
  return '#1f2937';
}

async function fetchWithTimeout(url: string, ms: number, headers?: HeadersInit) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal, headers, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
}

function bufferToDataUri(buf: Buffer, mime = 'image/png') {
  return `data:${mime};base64,${buf.toString('base64')}`;
}

function zoomFromRadius(lat: number, radiusM: number) {
  const widthPx = MAP_W;
  const metersPerPixelWanted = (Math.max(220, radiusM) * 2.35) / widthPx;
  const metersPerPixelZ0 = 156543.03392 * Math.cos((lat * Math.PI) / 180);
  const zoom = Math.log2(metersPerPixelZ0 / Math.max(0.4, metersPerPixelWanted));
  return Math.max(13, Math.min(17, Math.round(zoom * 10) / 10));
}

function mapboxOverlayPath(layout: CompsMapLayout) {
  const pins: string[] = [`pin-l-home+0f766e(${layout.subject.lng.toFixed(5)},${layout.subject.lat.toFixed(5)})`];
  for (const c of layout.mapped) {
    const geo = c.geo;
    if (!geo || !plotOnStreetMap(c, layout.subject)) continue;
    const label = c.index <= 99 ? String(c.index) : 'dot';
    pins.push(`pin-s-${label}+${pinColorHex(c)}(${geo.lng.toFixed(5)},${geo.lat.toFixed(5)})`);
  }
  return pins.join(',');
}

async function fetchMapboxStreetPng(layout: CompsMapLayout): Promise<string | null> {
  const token = mapboxToken();
  if (!token) return null;
  const overlay = mapboxOverlayPath(layout);
  const overlayPlain = overlay.replace('pin-l-home+', 'pin-l+');
  const size = `${MAP_W}x${MAP_H}@2x`;
  const zoom = zoomFromRadius(layout.subject.lat, layout.radiusM);
  const urls = [overlay, overlayPlain].flatMap((ov) => [
    `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${ov}/auto/${size}?padding=72&logo=true&access_token=${encodeURIComponent(token)}`,
    `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${ov}/${layout.subject.lng.toFixed(5)},${layout.subject.lat.toFixed(5)},${zoom},0/${size}?logo=true&access_token=${encodeURIComponent(token)}`,
  ]);

  for (const url of urls) {
    try {
      const res = await fetchWithTimeout(url, 9000);
      if (!res.ok) continue;
      const mime = res.headers.get('content-type') || 'image/png';
      if (!mime.includes('image')) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 800) continue;
      return bufferToDataUri(buf, mime.startsWith('image/') ? mime : 'image/png');
    } catch {
      continue;
    }
  }
  return null;
}

function lngLatToWorld(lng: number, lat: number, z: number) {
  const n = 2 ** z;
  const x = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y };
}

function osmZoom(radiusM: number) {
  if (radiusM <= 450) return 16;
  if (radiusM <= 1100) return 15;
  if (radiusM <= 2000) return 14;
  return 13;
}

function pinOverlaySvg(
  layout: CompsMapLayout,
  width: number,
  height: number,
  toPx: (lng: number, lat: number) => { x: number; y: number },
) {
  const subject = toPx(layout.subject.lng, layout.subject.lat);
  const pins = layout.mapped
    .filter((c) => plotOnStreetMap(c, layout.subject))
    .map((c) => {
      const geo = c.geo;
      if (!geo) return '';
      const p = toPx(geo.lng, geo.lat);
      return `<g>
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="11" fill="#fff"/>
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="9" fill="${pinFill(c)}"/>
        <text x="${p.x.toFixed(1)}" y="${(p.y + 3.6).toFixed(1)}" text-anchor="middle" fill="#fff" font-size="10" font-weight="700" font-family="-apple-system,BlinkMacSystemFont,sans-serif">${c.index}</text>
      </g>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <circle cx="${subject.x.toFixed(1)}" cy="${subject.y.toFixed(1)}" r="16" fill="#0f766e" fill-opacity="0.18" stroke="#0f766e" stroke-width="2"/>
    <circle cx="${subject.x.toFixed(1)}" cy="${subject.y.toFixed(1)}" r="6" fill="#0f766e"/>
    ${pins}
  </svg>`;
}

async function fetchOsmStreetPng(layout: CompsMapLayout): Promise<string | null> {
  try {
    const sharp = (await import('sharp')).default;
    const z = osmZoom(layout.radiusM);
    const origin = lngLatToWorld(layout.subject.lng, layout.subject.lat, z);
    const minTx = Math.floor(origin.x) - 1;
    const minTy = Math.floor(origin.y) - 1;
    const n = 2 ** z;
    const tiles: Array<{ input: Buffer; left: number; top: number }> = [];
    const jobs: Array<Promise<void>> = [];
    for (let dy = 0; dy < OSM_GRID; dy += 1) {
      for (let dx = 0; dx < OSM_GRID; dx += 1) {
        const tx = (((minTx + dx) % n) + n) % n;
        const ty = minTy + dy;
        if (ty < 0 || ty >= n) continue;
        jobs.push(
          (async () => {
            const url = `https://tile.openstreetmap.org/${z}/${tx}/${ty}.png`;
            const res = await fetchWithTimeout(url, 7000, {
              'User-Agent': 'EstateOS-market-report/1.0 (https://estateos.pl)',
            });
            if (!res.ok) return;
            const buf = Buffer.from(await res.arrayBuffer());
            if (buf.length < 200) return;
            tiles.push({ input: buf, left: dx * OSM_TILE, top: dy * OSM_TILE });
          })(),
        );
      }
    }
    await Promise.all(jobs);
    if (tiles.length < 4) return null;
    const width = OSM_GRID * OSM_TILE;
    const height = OSM_GRID * OSM_TILE;
    const base = await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: { r: 236, g: 232, b: 223, alpha: 1 },
      },
    })
      .composite(tiles)
      .png()
      .toBuffer();
    const toPx = (lng: number, lat: number) => {
      const p = lngLatToWorld(lng, lat, z);
      return { x: (p.x - minTx) * OSM_TILE, y: (p.y - minTy) * OSM_TILE };
    };
    const overlay = Buffer.from(pinOverlaySvg(layout, width, height, toPx));
    const out = await sharp(base).composite([{ input: overlay, top: 0, left: 0 }]).png().toBuffer();
    return bufferToDataUri(out);
  } catch {
    return null;
  }
}

function legendHtml(layout: CompsMapLayout) {
  const numbered = layout.mapped.filter((c) => c.index <= 8);
  const items = numbered
    .map((c) => {
      const addr = esc(c.address || c.district || 'okolica');
      const tags = [
        formatMarketType(c.marketType),
        formatDistance(c.distanceM),
        c.sameStreet ? 'ta sama ulica' : '',
        c.geo && plotOnStreetMap(c, layout.subject) ? '' : c.geo ? 'przy przedmiocie' : 'poza mapą',
      ]
        .filter(Boolean)
        .join(' · ');
      const fill = pinFill(c);
      return `<li style="margin:0 0 6px;break-inside:avoid">
        <span style="display:inline-block;width:18px;height:18px;border-radius:99px;background:${fill};color:#fff;font:700 11px/18px -apple-system,BlinkMacSystemFont,sans-serif;text-align:center;margin-right:6px">${c.index}</span>
        <strong style="font-weight:650">${addr}</strong>
        <span class="muted"> · ${esc(tags)}</span>
      </li>`;
    })
    .join('');
  return `<div class="map-legend">
    <div class="kicker" style="margin:10px 0 8px">MAPA TRANSAKCJI · RCN / GUGiK</div>
    <p class="muted" style="margin:0 0 8px">${esc(layout.loc)} · ${esc(layout.coord)} · promień próby ${layout.radiusM} m</p>
    <p class="muted" style="margin:0 0 8px"><span style="color:#0f766e;font-weight:700">● Przedmiot</span>
      · <span style="color:#0f766e">● ta sama ulica</span>
      · <span style="color:#1f2937">● inne akty</span>
      · <span style="color:#c2410c">● pierwotny</span>
      · numery = wiersze tabeli</p>
    <ol style="margin:0;padding:0;list-style:none;columns:2;column-gap:18px">${items}</ol>
  </div>`;
}

function fallbackPinSvg(layout: CompsMapLayout) {
  const withGeo = layout.mapped.filter((c) => plotOnStreetMap(c, layout.subject));
  const toLocal = (lat: number, lng: number) => {
    const east = (lng - layout.subject.lng) * 111_320 * Math.cos((layout.subject.lat * Math.PI) / 180);
    const north = (lat - layout.subject.lat) * 110_540;
    return { east, north };
  };
  const locals = withGeo.flatMap((c) => {
    const geo = c.geo;
    if (!geo) return [];
    return [{ c, ...toLocal(geo.lat, geo.lng) }];
  });
  const span = Math.max(
    layout.radiusM * 1.15,
    ...locals.map((p) => Math.abs(p.east)),
    ...locals.map((p) => Math.abs(p.north)),
    120,
  ) * 2.2;
  const pad = 36;
  const innerW = MAP_W - pad * 2;
  const innerH = MAP_H - pad * 2;
  const scale = Math.min(innerW / span, innerH / span);
  const cx = MAP_W / 2;
  const cy = MAP_H / 2;
  const toSvg = (east: number, north: number) => ({ x: cx + east * scale, y: cy - north * scale });
  const pins = locals
    .map(({ c, east, north }) => {
      const p = toSvg(east, north);
      return `<g>
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="11" fill="#fff"/>
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="9" fill="${pinFill(c)}"/>
        <text x="${p.x.toFixed(1)}" y="${(p.y + 3.6).toFixed(1)}" text-anchor="middle" fill="#fff" font-size="10" font-weight="700" font-family="-apple-system,BlinkMacSystemFont,sans-serif">${c.index}</text>
      </g>`;
    })
    .join('');
  return `<svg viewBox="0 0 ${MAP_W} ${MAP_H}" width="100%" role="img" aria-label="Mapa aktów notarialnych wokół nieruchomości" style="display:block;border:1px solid #e4e0d6;background:#f4f1ea">
    <rect width="${MAP_W}" height="${MAP_H}" fill="#f4f1ea"/>
    <circle cx="${cx}" cy="${cy}" r="16" fill="#0f766e" fill-opacity="0.16" stroke="#0f766e" stroke-width="2"/>
    <circle cx="${cx}" cy="${cy}" r="6" fill="#0f766e"/>
    <text x="${cx}" y="${cy - 22}" text-anchor="middle" fill="#0f766e" font-size="11" font-weight="700" font-family="-apple-system,BlinkMacSystemFont,sans-serif">Przedmiot</text>
    ${pins}
  </svg>`;
}

export function buildCompsMapSvg(result: ValuationResult, numberedCount = 8): string {
  const layout = layoutCompsMap(result, numberedCount);
  return `${fallbackPinSvg(layout)}${legendHtml(layout)}`;
}

export async function buildCompsMapHtml(result: ValuationResult, numberedCount = 8): Promise<string> {
  const layout = layoutCompsMap(result, numberedCount);
  let photo: string | null = null;
  let credit = '';
  if (!skipStreetMapFetch()) {
    photo = await fetchMapboxStreetPng(layout);
    if (photo) credit = '© Mapbox © OpenStreetMap';
    if (!photo) {
      photo = await fetchOsmStreetPng(layout);
      if (photo) credit = '© OpenStreetMap contributors';
    }
  }
  if (photo) {
    return `<figure class="map-block" style="margin:0 0 14px">
      <img class="map-photo" src="${photo}" alt="Mapa ulic z aktami notarialnymi wokół nieruchomości" width="100%" style="display:block;width:100%;height:auto;border:1px solid #e4e0d6"/>
      ${legendHtml(layout)}
      <p class="muted" style="margin:8px 0 0;font-size:11px">${esc(credit)}. Pinezki numerowane; adresy w legendzie, żeby etykiety się nie nakładały.</p>
    </figure>`;
  }
  return `<figure class="map-block" style="margin:0 0 14px">${fallbackPinSvg(layout)}${legendHtml(layout)}
    <p class="muted" style="margin:8px 0 0;font-size:11px">Mapa ulic niedostępna w tej chwili — numery i adresy są w legendzie oraz w tabeli.</p>
  </figure>`;
}

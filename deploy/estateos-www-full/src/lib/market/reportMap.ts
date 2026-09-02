import type { MarketComp, ValuationResult, ValuationSubject } from '@/lib/market/types';

const MAP_W = 720;
const MAP_H = 468;
const PAD = 54;

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

function hash01(n: number) {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function toLocal(lat: number, lng: number, origin: ValuationSubject) {
  const x = (lng - origin.lng) * 111_320 * Math.cos((origin.lat * Math.PI) / 180);
  const y = (lat - origin.lat) * 110_540;
  return { x, y };
}

function fallbackCoord(comp: MarketComp, origin: ValuationSubject) {
  if (
    comp.lat != null &&
    comp.lng != null &&
    Number.isFinite(comp.lat) &&
    Number.isFinite(comp.lng)
  ) {
    return { lat: comp.lat, lng: comp.lng };
  }
  const angle = hash01(comp.id) * Math.PI * 2;
  const d = Math.max(40, comp.distanceM || 120);
  const dLat = (Math.cos(angle) * d) / 110_540;
  const dLng = (Math.sin(angle) * d) / (111_320 * Math.cos((origin.lat * Math.PI) / 180));
  return { lat: origin.lat + dLat, lng: origin.lng + dLng };
}

function niceScaleMeters(spanM: number) {
  const target = spanM * 0.22;
  const steps = [50, 100, 150, 200, 250, 400, 500, 800, 1000, 1500, 2000];
  return steps.find((s) => s >= target) || 2000;
}

type MappedComp = MarketComp & {
  east: number;
  north: number;
  sameStreet: boolean;
  primary: boolean;
  index: number;
};

export function buildCompsMapSvg(result: ValuationResult, numberedCount = 8): string {
  const subject = result.subject;
  const comps = (result.comps || []).slice(0, 24);
  const subjectStem = streetStem(subject.address);
  const radius = Math.max(200, result.stats.basis === 'comps' ? result.stats.radiusM || 800 : 800);

  const mapped: MappedComp[] = comps.map((c, i) => {
    const geo = fallbackCoord(c, subject);
    const local = toLocal(geo.lat, geo.lng, subject);
    const stem = streetStem(c.address);
    return {
      ...c,
      east: local.x,
      north: local.y,
      sameStreet: Boolean(subjectStem && stem && stem === subjectStem),
      primary: formatMarketType(c.marketType) === 'pierwotny',
      index: i + 1,
    };
  });

  const maxEast = Math.max(radius * 1.08, ...mapped.map((c) => Math.abs(c.east)), 120);
  const maxNorth = Math.max(radius * 1.08, ...mapped.map((c) => Math.abs(c.north)), 120);
  const span = Math.max(maxEast, maxNorth) * 2.15;
  const innerW = MAP_W - PAD * 2;
  const innerH = MAP_H - PAD * 2;
  const scale = Math.min(innerW / span, innerH / span);

  const cx = MAP_W / 2;
  const cy = MAP_H / 2;
  const toSvg = (east: number, north: number) => ({
    x: cx + east * scale,
    y: cy - north * scale,
  });

  const rings = [400, 800, 1500, 2500].filter((r) => r <= radius * 1.05 || r === radius);
  const uniqueRings = [...new Set([...rings, radius])].sort((a, b) => a - b);

  const streets = new Map<string, MappedComp[]>();
  for (const c of mapped) {
    const key = streetStem(c.address) || '';
    if (!key) continue;
    const list = streets.get(key) || [];
    list.push(c);
    streets.set(key, list);
  }

  const ringCircles = uniqueRings
    .map((r) => {
      const px = r * scale;
      const label = toSvg(r * 0.72, r * 0.72);
      return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${px.toFixed(1)}" fill="none" stroke="${
        r === radius ? '#0f766e' : '#c5c1b7'
      }" stroke-width="${r === radius ? 1.6 : 0.9}" stroke-dasharray="${r === radius ? '0' : '5 5'}" />
      <text x="${label.x.toFixed(1)}" y="${label.y.toFixed(1)}" fill="#6b6b70" font-size="10" font-family="-apple-system,BlinkMacSystemFont,sans-serif">${r} m</text>`;
    })
    .join('');

  const streetLines = [...streets.entries()]
    .filter(([, pts]) => pts.length >= 2)
    .map(([name, pts]) => {
      const origin = toSvg(0, 0);
      const sorted = [...pts].sort((a, b) => a.east - b.east || a.north - b.north);
      const d = [`M ${origin.x.toFixed(1)} ${origin.y.toFixed(1)}`]
        .concat(sorted.map((p) => {
          const s = toSvg(p.east, p.north);
          return `L ${s.x.toFixed(1)} ${s.y.toFixed(1)}`;
        }))
        .join(' ');
      const mid = sorted[Math.floor(sorted.length / 2)];
      const labelAt = toSvg(mid.east, mid.north + 18);
      const emphasis = name === subjectStem;
      return `<path d="${d}" fill="none" stroke="${emphasis ? '#0f766e' : '#8a8680'}" stroke-width="${
        emphasis ? 3.2 : 1.8
      }" stroke-linecap="round" opacity="${emphasis ? 0.55 : 0.28}" />
      <text x="${labelAt.x.toFixed(1)}" y="${(labelAt.y - 10).toFixed(1)}" text-anchor="middle" fill="${
        emphasis ? '#0f766e' : '#5c5c63'
      }" font-size="10" font-weight="${emphasis ? 700 : 500}" font-family="-apple-system,BlinkMacSystemFont,sans-serif">${esc(
        name.replace(/\b\w/g, (ch) => ch.toUpperCase()),
      )}</text>`;
    })
    .join('');

  const parcels = mapped
    .map((c) => {
      const p = toSvg(c.east, c.north);
      const size = Math.max(7, Math.min(16, Math.sqrt(Math.max(20, c.area || 40)) * 0.55));
      const rot = (hash01(c.id + 9) - 0.5) * 50;
      const fill = c.primary ? '#f4e6d8' : c.sameStreet ? '#d7efe9' : '#ece8df';
      const stroke = c.primary ? '#c2410c' : c.sameStreet ? '#0f766e' : '#b7b1a6';
      return `<rect x="${(p.x - size / 2).toFixed(1)}" y="${(p.y - size / 2).toFixed(1)}" width="${size.toFixed(
        1,
      )}" height="${size.toFixed(1)}" rx="1.4" fill="${fill}" stroke="${stroke}" stroke-width="0.8" transform="rotate(${rot.toFixed(
        1,
      )} ${p.x.toFixed(1)} ${p.y.toFixed(1)})" />`;
    })
    .join('');

  const pins = mapped
    .map((c) => {
      const p = toSvg(c.east, c.north);
      const numbered = c.index <= numberedCount;
      const r = numbered ? 9 : 4.5;
      const fill = c.primary ? '#c2410c' : c.sameStreet ? '#0f766e' : '#1f2937';
      const label = numbered
        ? `<text x="${p.x.toFixed(1)}" y="${(p.y + 3.4).toFixed(
            1,
          )}" text-anchor="middle" fill="#fff" font-size="9" font-weight="700" font-family="-apple-system,BlinkMacSystemFont,sans-serif">${c.index}</text>`
        : '';
      const caption =
        numbered && c.address
          ? `<text x="${(p.x + 11).toFixed(1)}" y="${(p.y - 11).toFixed(
              1,
            )}" fill="#16161a" font-size="9" font-family="-apple-system,BlinkMacSystemFont,sans-serif">${esc(
              String(c.address).slice(0, 28),
            )}</text>`
          : '';
      return `<g>
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r + 1.6}" fill="#fff" />
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r}" fill="${fill}" />
        ${label}${caption}
      </g>`;
    })
    .join('');

  const scaleM = niceScaleMeters(span);
  const scalePx = scaleM * scale;
  const scaleY = MAP_H - 18;
  const scaleX = 18;

  const loc = [subject.address, subject.district, subject.city].filter(Boolean).join(', ');
  const coord = `${subject.lat.toFixed(5)}° N  ${subject.lng.toFixed(5)}° E`;

  return `<svg viewBox="0 0 ${MAP_W} ${MAP_H}" width="100%" role="img" aria-label="Mapa aktów notarialnych wokół nieruchomości" style="display:block;border:1px solid #e4e0d6;background:#f6f3ec">
    <rect width="${MAP_W}" height="${MAP_H}" fill="#f6f3ec" />
    <g opacity="0.35">
      ${Array.from({ length: 9 }, (_, i) => {
        const x = PAD + ((i + 1) * innerW) / 10;
        const y = PAD + ((i + 1) * innerH) / 10;
        return `<line x1="${x}" y1="${PAD}" x2="${x}" y2="${MAP_H - PAD}" stroke="#d9d4c8" stroke-width="0.6" />
        <line x1="${PAD}" y1="${y}" x2="${MAP_W - PAD}" y2="${y}" stroke="#d9d4c8" stroke-width="0.6" />`;
      }).join('')}
    </g>
    ${ringCircles}
    ${streetLines}
    ${parcels}
    <circle cx="${cx}" cy="${cy}" r="${Math.max(16, 28 * scale)}" fill="#0f766e" fill-opacity="0.12" stroke="#0f766e" stroke-width="2" />
    <circle cx="${cx}" cy="${cy}" r="5" fill="#0f766e" />
    <text x="${cx}" y="${cy - 22}" text-anchor="middle" fill="#0f766e" font-size="11" font-weight="700" font-family="-apple-system,BlinkMacSystemFont,sans-serif">Przedmiot</text>
    ${pins}
    <rect x="0" y="0" width="${MAP_W}" height="36" fill="#16161a" />
    <text x="14" y="16" fill="#f6f3ec" font-size="10" letter-spacing="1.4" font-weight="700" font-family="-apple-system,BlinkMacSystemFont,sans-serif">MAPA TRANSAKCJI · RCN / GUGiK</text>
    <text x="14" y="30" fill="#c5c1b7" font-size="10" font-family="-apple-system,BlinkMacSystemFont,sans-serif">${esc(loc)} · ${esc(coord)}</text>
    <g>
      <rect x="${scaleX}" y="${scaleY - 8}" width="${scalePx}" height="3" fill="#16161a" />
      <rect x="${scaleX}" y="${scaleY - 11}" width="2" height="9" fill="#16161a" />
      <rect x="${scaleX + scalePx - 2}" y="${scaleY - 11}" width="2" height="9" fill="#16161a" />
      <text x="${scaleX}" y="${scaleY - 16}" fill="#16161a" font-size="10" font-family="-apple-system,BlinkMacSystemFont,sans-serif">${scaleM >= 1000 ? `${scaleM / 1000} km` : `${scaleM} m`}</text>
    </g>
    <g transform="translate(${MAP_W - 36}, 54)">
      <polygon points="0,-16 4,6 -4,6" fill="#16161a" />
      <text y="18" text-anchor="middle" fill="#16161a" font-size="9" font-weight="700" font-family="-apple-system,BlinkMacSystemFont,sans-serif">N</text>
    </g>
    <g font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="10" fill="#3f3f46">
      <circle cx="18" cy="${MAP_H - 36}" r="5" fill="#0f766e" />
      <text x="28" y="${MAP_H - 32}">ta sama ulica</text>
      <circle cx="128" cy="${MAP_H - 36}" r="5" fill="#1f2937" />
      <text x="138" y="${MAP_H - 32}">inne akty w promieniu</text>
      <circle cx="292" cy="${MAP_H - 36}" r="5" fill="#c2410c" />
      <text x="302" y="${MAP_H - 32}">rynek pierwotny</text>
      <text x="430" y="${MAP_H - 32}">numery = wiersze tabeli</text>
    </g>
  </svg>`;
}

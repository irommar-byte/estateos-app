import { ImageResponse } from 'next/og';
import sharp from 'sharp';
import type { CSSProperties, ReactNode } from 'react';
import { loadOgFonts } from '@/lib/og/ogFonts';
import { loadPhotoBuffer } from '@/lib/buildShareOgJpeg';
import { resolvePublicAppOrigin, type OfferShareCard } from '@/lib/offerShareLanding';
import { offerSheetData, type OfferSheetData } from '@/lib/offerSheetData';
import { buildSheetPlan, type SheetPlan } from '@/lib/offerSheetPlan';
import type { FloorPlanScanMeta } from '@/types/roomScan';

/**
 * Ofertówka A4 rysowana na serwerze (ten sam silnik co podglądy na Facebooka).
 * Projekt w jednostkach 794 × 1123 (A4 przy 96 dpi), wyjście 2× — 1588 × 2246 px.
 * Ten sam obraz idzie do podglądu, JPEG, PDF i druku — co do piksela.
 */
export type OfferSheetStyleId = 'galeria' | 'architekt' | 'pelna';

const W = 794;
const H = 1123;
const D = 2;
const INK = '#15171a';
const INK2 = '#3b3e45';
const MUTED = '#6b6e75';
const LINE = '#e6e2da';
const BLUE = '#2f4fd8';
const CREAM = '#f4f1ea';
const PLAN_FULL = { w: 440, h: 300 };
const PLAN_ARCH = { w: 350, h: 396 };

type Assets = {
  hero: string | null;
  photos: Array<string | null>;
  avatar: string | null;
  qr: string | null;
  map: string | null;
  plan: SheetPlan | null;
  planImage: string | null;
};

function abs(url: string): string {
  return /^https?:\/\//.test(url) ? url : `${resolvePublicAppOrigin()}${url.startsWith('/') ? '' : '/'}${url}`;
}

async function toDataUri(buf: Buffer | null, w: number, h: number, fit: 'cover' | 'contain' = 'cover'): Promise<string | null> {
  if (!buf) return null;
  try {
    const out = await sharp(buf)
      .rotate()
      .resize(Math.round(w * D), Math.round(h * D), { fit, position: 'attention', background: '#ffffff' })
      .jpeg({ quality: 84, mozjpeg: true })
      .toBuffer();
    return `data:image/jpeg;base64,${out.toString('base64')}`;
  } catch {
    return null;
  }
}

async function photo(url: string | null | undefined, w: number, h: number, fit: 'cover' | 'contain' = 'cover') {
  if (!url) return null;
  return toDataUri(await loadPhotoBuffer(abs(url)), w, h, fit);
}

async function fetchBuffer(url: string, timeoutMs = 7000): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: 'force-cache' });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length ? buf : null;
  } catch {
    return null;
  }
}

async function loadAssets(data: OfferSheetData, style: OfferSheetStyleId, scanMeta: FloorPlanScanMeta | null): Promise<Assets> {
  const heroSize = style === 'galeria' ? [W, 450] : style === 'architekt' ? [380, 268] : [W, 292];
  const photoSize = style === 'galeria' ? [230, 172] : style === 'architekt' ? [326, PLAN_ARCH.h - 44] : [262, 143];
  const planSize = style === 'architekt' ? [PLAN_ARCH.w - 24, PLAN_ARCH.h - 44] : [PLAN_FULL.w - 24, PLAN_FULL.h - 44];
  const [hero, p1, p2, p3, avatar, qrBuf, mapBuf, plan] = await Promise.all([
    photo(data.hero, heroSize[0], heroSize[1]),
    photo(data.photos[0], photoSize[0], photoSize[1]),
    photo(data.photos[1], photoSize[0], photoSize[1]),
    style === 'galeria' ? photo(data.photos[2], photoSize[0], photoSize[1]) : Promise.resolve(null),
    data.agent?.image ? photo(data.agent.image, 52, 52) : Promise.resolve(null),
    fetchBuffer(`https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=0&color=15171a&bgcolor=ffffff&data=${encodeURIComponent(data.canonicalUrl)}`),
    style === 'architekt' && data.lat != null && data.lng != null
      ? fetchBuffer(abs(`/api/map/static?lat=${data.lat}&lng=${data.lng}&styl=teren`))
      : Promise.resolve(null),
    style === 'galeria' ? Promise.resolve(null) : buildSheetPlan(scanMeta, planSize[0], planSize[1]).catch(() => null),
  ]);
  const planImage = style !== 'galeria' && !plan && data.floorPlanUrl ? await photo(data.floorPlanUrl, planSize[0], planSize[1], 'contain') : null;
  return {
    hero,
    photos: [p1, p2, p3],
    avatar,
    qr: qrBuf ? `data:image/png;base64,${qrBuf.toString('base64')}` : null,
    map: await toDataUri(mapBuf, 326, PLAN_ARCH.h - 44),
    plan,
    planImage,
  };
}

/* ───────────── elementy wspólne ───────────── */

const label = (extra: CSSProperties = {}): CSSProperties => ({ fontSize: 9.5, fontWeight: 600, letterSpacing: 1.6, textTransform: 'uppercase', color: MUTED, ...extra });
/** Skraca na granicy słowa, żeby kartka nigdy nie ucinała w połowie wyrazu. */
function shortText(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max).replace(/\s+\S*$/, '').replace(/[,;:–—-]+$/, '');
  return `${cut}…`;
}
const clamp = (lines: number, extra: CSSProperties = {}): CSSProperties =>
  ({ display: 'block', lineClamp: lines, overflow: 'hidden', ...extra }) as CSSProperties;

function Img({ src, style }: { src: string | null; style: CSSProperties }) {
  if (!src) return <div style={{ display: 'flex', background: '#e9e5de', ...style }} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" style={{ objectFit: 'cover', ...style }} />;
}

function Specs({ rows, rowH = 31, size = 14 }: { rows: OfferSheetData['rows']; rowH?: number; size?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {rows.map((row, i) => (
        <div
          key={row.label}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: rowH, borderBottom: i === rows.length - 1 ? 'none' : `1px solid ${LINE}` }}
        >
          <span style={label()}>{row.label}</span>
          <span style={{ fontSize: size, fontWeight: 600, color: INK, maxWidth: 230, textAlign: 'right' }}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function Chips({ items, dark = false }: { items: string[]; dark?: boolean }) {
  if (!items.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {items.map((item) => (
        <span key={item} style={{ display: 'flex', fontSize: 11, fontWeight: 600, color: INK, padding: '5px 11px', borderRadius: 999, background: dark ? '#ffffff' : '#f1eee8', border: dark ? `1px solid ${LINE}` : 'none' }}>
          {item}
        </span>
      ))}
    </div>
  );
}

function PlanBox({ a, w, h, title = 'Rzut mieszkania' }: { a: Assets; w: number; h: number; title?: string }) {
  const plan = a.plan;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: w, height: h, background: '#ffffff', border: `1px solid ${LINE}`, borderRadius: 14, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={label()}>{plan ? `${title} · skan LiDAR` : title}</span>
        {plan?.totalArea ? <span style={{ fontSize: 11, fontWeight: 600, color: INK2 }}>{plan.totalArea}</span> : null}
      </div>
      <div style={{ display: 'flex', position: 'relative', flex: 1, marginTop: 6 }}>
        {plan ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={plan.image} alt="" style={{ position: 'absolute', left: 0, top: 0, width: w - 24, height: h - 44 }} />
            {plan.labels.map((l) => (
              <div
                key={`${l.label}-${l.x}`}
                style={{ position: 'absolute', left: l.x - 60, top: l.y - (l.small ? 12 : 15), width: 120, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
              >
                <span style={{ fontSize: l.small ? 9 : 11, fontWeight: 700, color: INK }}>{l.label}</span>
                <span style={{ fontSize: l.small ? 8 : 9.5, fontWeight: 600, color: '#2f5fa8', marginTop: 1 }}>{l.area}</span>
              </div>
            ))}
          </>
        ) : a.planImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.planImage} alt="" style={{ width: w - 24, height: h - 44, objectFit: 'contain' }} />
        ) : a.map ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.map} alt="" style={{ width: w - 24, height: h - 44, objectFit: 'cover', borderRadius: 8 }} />
        ) : null}
      </div>
    </div>
  );
}

function Footer({ data, a, line = INK }: { data: OfferSheetData; a: Assets; line?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `2px solid ${line}`, paddingTop: 14 }}>
      {data.agent ? (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {a.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.avatar} alt="" style={{ width: 52, height: 52, borderRadius: 26, objectFit: 'cover' }} />
          ) : (
            <div style={{ display: 'flex', width: 52, height: 52, borderRadius: 26, background: INK, color: '#fff', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700 }}>
              {data.agent.initials}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 14 }}>
            <span style={label()}>{data.agent.role}</span>
            <span style={{ fontSize: 17, fontWeight: 700, color: INK, marginTop: 3 }}>{data.agent.name}</span>
            <span style={{ fontSize: 11, color: INK2, marginTop: 3 }}>{[data.agent.company, data.agent.contact].filter(Boolean).join('  ·  ')}</span>
          </div>
        </div>
      ) : (
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 4 }}>ESTATEOS™</span>
      )}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginRight: 12 }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: INK }}>{data.url}</span>
          <span style={{ fontSize: 9.5, color: MUTED, marginTop: 3 }}>Zeskanuj: galeria, mapa, termin</span>
        </div>
        {a.qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.qr} alt="" style={{ width: 62, height: 62 }} />
        ) : null}
      </div>
    </div>
  );
}

function BrandBar({ data, light = true }: { data: OfferSheetData; light?: boolean }) {
  const color = light ? '#ffffff' : INK;
  return (
    <div
      style={{
        position: 'absolute', left: 0, right: 0, top: 0, height: 86, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '24px 40px',
        backgroundImage: light ? 'linear-gradient(180deg, rgba(0,0,0,0.5), rgba(0,0,0,0))' : 'none',
      }}
    >
      <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 4.5, color }}>ESTATEOS™</span>
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, color, textTransform: 'uppercase' }}>{`${data.transaction} · ${data.ref}`}</span>
    </div>
  );
}

/* ───────────── trzy style ───────────── */

function Pelna({ data, a }: { data: OfferSheetData; a: Assets }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: W, height: H, background: '#ffffff', color: INK }}>
      <div style={{ display: 'flex', position: 'relative', height: 292 }}>
        <Img src={a.hero} style={{ width: W, height: 292 }} />
        <BrandBar data={data} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '24px 40px 26px' }}>
        <span style={label({ color: BLUE })}>{data.kicker}</span>
        <div style={clamp(2, { fontSize: 25, fontWeight: 700, lineHeight: 1.2, letterSpacing: -0.4, marginTop: 7 })}>{data.title}</div>
        <span style={{ fontSize: 12.5, color: MUTED, marginTop: 5 }}>{data.address}</span>
        <div style={{ display: 'flex', height: 2, background: INK, marginTop: 14 }} />
        <div style={{ display: 'flex', marginTop: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', width: 330, marginRight: 34 }}>
            <span style={label()}>Cena</span>
            <span style={{ fontSize: 38, fontWeight: 700, letterSpacing: -1.2, marginTop: 2 }}>{data.price}</span>
            {data.ppsm ? <span style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{data.ppsm}</span> : null}
            {data.description ? <div style={clamp(6, { fontSize: 11.5, lineHeight: 1.55, color: INK2, marginTop: 12 })}>{shortText(data.description, 300)}</div> : null}
            <div style={{ display: 'flex', marginTop: 12 }}>
              <Chips items={data.amenities} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <Specs rows={data.rows} />
          </div>
        </div>
        <div style={{ display: 'flex', marginTop: 'auto', marginBottom: 16 }}>
          <PlanBox a={a} w={PLAN_FULL.w} h={PLAN_FULL.h} />
          <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 14, width: 260, justifyContent: 'space-between' }}>
            <Img src={a.photos[0]} style={{ width: 260, height: 143, borderRadius: 14 }} />
            <Img src={a.photos[1]} style={{ width: 260, height: 143, borderRadius: 14 }} />
          </div>
        </div>
        <Footer data={data} a={a} />
      </div>
    </div>
  );
}

function Galeria({ data, a }: { data: OfferSheetData; a: Assets }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: W, height: H, background: '#ffffff', color: INK }}>
      <div style={{ display: 'flex', position: 'relative', height: 450 }}>
        <Img src={a.hero} style={{ width: W, height: 450 }} />
        <BrandBar data={data} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '26px 40px 26px' }}>
        <span style={label({ color: BLUE })}>{data.kicker}</span>
        <div style={clamp(2, { fontSize: 27, fontWeight: 700, lineHeight: 1.18, letterSpacing: -0.5, marginTop: 7 })}>{data.title}</div>
        <span style={{ fontSize: 12.5, color: MUTED, marginTop: 5 }}>{data.address}</span>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 16 }}>
          <span style={{ fontSize: 42, fontWeight: 700, letterSpacing: -1.4 }}>{data.price}</span>
          {data.ppsm ? <span style={{ fontSize: 13, color: MUTED }}>{data.ppsm}</span> : null}
        </div>
        <div style={{ display: 'flex', borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}`, marginTop: 12, padding: '12px 0' }}>
          {data.big.map((item, i) => (
            <div key={item.label} style={{ display: 'flex', flexDirection: 'column', flex: 1, paddingLeft: i ? 16 : 0, borderLeft: i ? `1px solid ${LINE}` : 'none' }}>
              <span style={{ fontSize: 21, fontWeight: 700 }}>{item.value}</span>
              <span style={{ fontSize: 10.5, color: MUTED, marginTop: 2 }}>{item.label}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', marginTop: 14 }}>
          <Chips items={data.amenities} />
        </div>
        {data.description ? <div style={clamp(4, { fontSize: 12, lineHeight: 1.55, color: INK2, marginTop: 12 })}>{shortText(data.description, 420)}</div> : null}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto', marginBottom: 16 }}>
          {[0, 1, 2].map((i) => (
            <Img key={i} src={a.photos[i]} style={{ width: 230, height: 172, borderRadius: 12 }} />
          ))}
        </div>
        <Footer data={data} a={a} />
      </div>
    </div>
  );
}

function Architekt({ data, a }: { data: OfferSheetData; a: Assets }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: W, height: H, background: CREAM, color: INK }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '22px 40px 14px', borderBottom: `1.5px solid ${INK}`, margin: '0 40px', paddingLeft: 0, paddingRight: 0 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: 4.5 }}>ESTATEOS™</span>
        <span style={label({ color: INK2 })}>{data.ref}</span>
        <span style={label({ color: INK2 })}>{data.kicker}</span>
        <span style={label({ color: BLUE })}>{data.transaction}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '20px 40px 26px' }}>
        <div style={clamp(2, { fontSize: 26, fontWeight: 700, lineHeight: 1.18, letterSpacing: -0.5 })}>{data.title}</div>
        <span style={{ fontSize: 12.5, color: MUTED, marginTop: 5 }}>{data.address}</span>
        <div style={{ display: 'flex', marginTop: 18 }}>
          <Img src={a.hero} style={{ width: 380, height: 268, borderRadius: 6 }} />
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, marginLeft: 22 }}>
            <Specs rows={data.rows.slice(0, 6)} rowH={28} size={13} />
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto' }}>
              <span style={label({ color: BLUE })}>Cena</span>
              <span style={{ fontSize: 32, fontWeight: 700, letterSpacing: -1, marginTop: 2 }}>{data.price}</span>
              {data.ppsm ? <span style={{ fontSize: 11.5, color: MUTED }}>{data.ppsm}</span> : null}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', marginTop: 18, justifyContent: 'space-between' }}>
          <PlanBox a={{ ...a, map: null }} w={PLAN_ARCH.w} h={PLAN_ARCH.h} />
          <div style={{ display: 'flex', flexDirection: 'column', width: PLAN_ARCH.w, height: PLAN_ARCH.h, background: '#ffffff', border: `1px solid ${LINE}`, borderRadius: 14, padding: 12 }}>
            <span style={label()}>{a.map ? 'Położenie' : 'Wnętrze'}</span>
            <Img src={a.map || a.photos[0]} style={{ width: 326, height: PLAN_ARCH.h - 44, borderRadius: 8, marginTop: 6 }} />
          </div>
        </div>
        <div style={{ display: 'flex', marginTop: 16 }}>
          <Chips items={data.amenities} dark />
        </div>
        {data.description ? <div style={clamp(4, { fontSize: 11.5, lineHeight: 1.55, color: INK2, marginTop: 12 })}>{shortText(data.description, 380)}</div> : null}
        <div style={{ display: 'flex', marginTop: 'auto' }} />
        <Footer data={data} a={a} />
      </div>
    </div>
  );
}

export async function renderOfferSheet(card: OfferShareCard, style: OfferSheetStyleId, scanMeta: FloorPlanScanMeta | null): Promise<ImageResponse> {
  const data = offerSheetData(card);
  const [fonts, assets] = await Promise.all([loadOgFonts(), loadAssets(data, style, scanMeta)]);
  const Page = style === 'galeria' ? Galeria : style === 'architekt' ? Architekt : Pelna;
  const page: ReactNode = (
    <div style={{ display: 'flex', position: 'relative', width: W * D, height: H * D, background: '#ffffff' }}>
      {/* silnik skaluje względem środka — kładziemy kartkę tak, by po skali wypełniła całe płótno */}
      <div style={{ display: 'flex', position: 'absolute', left: (W * (D - 1)) / 2, top: (H * (D - 1)) / 2, width: W, height: H, transform: `scale(${D})`, fontFamily: 'Inter' }}>
        <Page data={data} a={assets} />
      </div>
    </div>
  );
  return new ImageResponse(page as React.ReactElement, {
    width: W * D,
    height: H * D,
    fonts: fonts.map((f) => ({ ...f })),
    headers: { 'Cache-Control': 'private, max-age=120' },
  });
}

'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { OfferShareCard } from '@/lib/offerShareLanding';
import { buildOfferShareQrSrc, fitSheetText, truncateOfferShareDescription } from '@/lib/offerSharePrint';
import { offerFontVars } from '@/components/offer/offerFonts';
import type { OfferSheetStyle } from '@/components/offer/offerSheetStyle';

/** Projekt na stronę 595 × 842 pt, rysowany w pikselach A4 (794 × 1123). */
const K = 794 / 595;
const u = (n: number) => `${Math.round(n * K * 100) / 100}px`;

const INK = '#15171a';
const INK_2 = '#3d4046';
const MUTED = '#5d6068';
const LINE = '#e3e0da';
const BLUE = '#2f4fd8';
const SANS = 'var(--ofb-sans), "Inter Tight", Inter, Arial, sans-serif';
const MONO = 'var(--ofb-mono), "IBM Plex Mono", ui-monospace, monospace';

const mono = (size: number, extra: CSSProperties = {}): CSSProperties => ({
  fontFamily: MONO,
  fontSize: u(size),
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  ...extra,
});

function shorten(text: string, max: number): string {
  const s = String(text || '').trim();
  return s.length <= max ? s : `${s.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
}

type SheetData = {
  hero: string | null;
  photos: string[];
  title: string;
  kicker: string;
  address: string;
  price: string;
  ppsm: string | null;
  description: string;
  rows: Array<{ label: string; value: string }>;
  big: Array<{ label: string; value: string }>;
  amenities: string[];
  plan: { kind: 'image'; src: string } | { kind: 'rooms'; rooms: Array<{ name: string; areaLabel: string }>; total: string | null } | null;
  map: string | null;
  qr: string;
  url: string;
  agent: { name: string; company: string | null; contact: string; image: string | null; initials: string; role: string } | null;
  ref: string;
  transaction: string;
};

function sheetData(card: OfferShareCard): SheetData {
  const floor =
    card.floor == null || String(card.floor).trim() === ''
      ? null
      : Number(card.floor) === 0
        ? 'parter'
        : card.totalFloors
          ? `${card.floor} z ${card.totalFloors}`
          : String(card.floor);
  const rows = [
    card.area != null ? { label: 'Powierzchnia', value: `${card.area} m²` } : null,
    card.plotArea ? { label: 'Działka', value: `${card.plotArea} m²` } : null,
    card.rooms != null ? { label: 'Pokoje', value: String(card.rooms) } : null,
    floor ? { label: 'Piętro', value: floor } : null,
    card.yearBuilt != null ? { label: 'Rok budowy', value: String(card.yearBuilt) } : null,
    card.conditionLabel ? { label: 'Stan', value: card.conditionLabel } : null,
    card.heating ? { label: 'Ogrzewanie', value: card.heating } : null,
    card.adminFeeLabel ? { label: 'Czynsz adm.', value: card.adminFeeLabel } : null,
  ].filter((row): row is { label: string; value: string } => Boolean(row));
  const big = [
    card.area != null ? { label: 'powierzchnia', value: `${card.area} m²` } : null,
    card.rooms != null ? { label: 'pokoje', value: String(card.rooms) } : null,
    floor ? { label: 'piętro', value: floor.replace(' z ', ' / ') } : null,
    card.yearBuilt != null ? { label: 'rok budowy', value: String(card.yearBuilt) } : null,
  ].filter((row): row is { label: string; value: string } => Boolean(row));
  const roomsTotal = card.roomAreas.length
    ? card.roomAreas.reduce((sum, room) => sum + (Number.parseFloat(room.areaLabel.replace(',', '.')) || 0), 0)
    : 0;
  const publisher = card.publisher;
  const agentName = publisher ? publisher.personName || publisher.displayName : '';
  return {
    hero: card.imageUrl || card.images[0] || null,
    photos: card.gallery,
    title: shorten(card.title, 80),
    kicker: [card.propertyTypeLabel, [card.city, card.district].filter(Boolean).join(' / ')].filter(Boolean).join(' · '),
    address: card.addressLine || card.locationLabel,
    price: card.priceLabel,
    ppsm: card.pricePerSqmLabel,
    description: truncateOfferShareDescription(card.description, 260),
    rows: rows.slice(0, 8),
    big,
    amenities: card.amenities.slice(0, 6),
    plan: card.floorPlanUrl
      ? { kind: 'image', src: card.floorPlanUrl }
      : card.roomAreas.length
        ? {
            kind: 'rooms',
            rooms: card.roomAreas.slice(0, 8),
            total: roomsTotal ? `${roomsTotal.toFixed(1).replace('.', ',')} m²` : null,
          }
        : null,
    map:
      card.lat != null && card.lng != null
        ? `/api/map/static?lat=${encodeURIComponent(String(card.lat))}&lng=${encodeURIComponent(String(card.lng))}&styl=teren`
        : null,
    qr: buildOfferShareQrSrc(card.canonicalUrl, 320),
    url: `estateos.pl/o/${card.id}`,
    agent: publisher
      ? {
          name: agentName,
          company: publisher.companyName && publisher.companyName !== agentName ? publisher.companyName : null,
          contact: [publisher.phone, publisher.email].filter(Boolean).join(' · '),
          image: publisher.imageUrl,
          initials: agentName
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part.charAt(0).toUpperCase())
            .join(''),
          role: publisher.isPresentingAgent ? 'Twój doradca' : publisher.isAgent ? 'Opiekun oferty' : 'Kontakt',
        }
      : null,
    ref: `Nr OF-${card.id}`,
    transaction: card.transactionLabel,
  };
}

function Img({ src, style }: { src: string; style?: CSSProperties }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" crossOrigin="anonymous" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', ...style }} />;
}

function Photo({ src, style }: { src: string | null | undefined; style?: CSSProperties }) {
  return (
    <div style={{ background: '#e7e3dc', overflow: 'hidden', ...style }}>{src ? <Img src={src} /> : null}</div>
  );
}

function Avatar({ agent, size, dark = true }: { agent: NonNullable<SheetData['agent']>; size: number; dark?: boolean }) {
  return (
    <div
      style={{
        width: u(size),
        height: u(size),
        flexShrink: 0,
        borderRadius: '50%',
        overflow: 'hidden',
        background: dark ? INK : '#ffffff',
        color: dark ? '#ffffff' : INK,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: SANS,
        fontWeight: 600,
        fontSize: u(size * 0.34),
      }}
    >
      {agent.image ? <Img src={agent.image} /> : agent.initials || 'E'}
    </div>
  );
}

function Qr({ data, size }: { data: SheetData; size: number }) {
  return (
    <div style={{ width: u(size), height: u(size), flexShrink: 0, background: '#ffffff', border: `1px solid ${LINE}`, padding: u(3), boxSizing: 'border-box' }}>
      <Img src={data.qr} style={{ objectFit: 'contain' }} />
    </div>
  );
}

function Chips({ items, boxed }: { items: string[]; boxed: boolean }) {
  if (!items.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: u(4) }}>
      {items.map((item) =>
        boxed ? (
          <span key={item} style={{ ...mono(7.5), border: `1px solid ${INK}`, padding: `${u(2)} ${u(5)}` }}>
            {item}
          </span>
        ) : (
          <span key={item} style={{ fontFamily: SANS, fontSize: u(10), fontWeight: 500, padding: `${u(5)} ${u(9)}`, borderRadius: 999, background: '#f2f0ec' }}>
            {item}
          </span>
        ),
      )}
    </div>
  );
}

function SpecTable({ rows, rowHeight, valueSize }: { rows: SheetData['rows']; rowHeight: number; valueSize: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {rows.map((row, index) => (
        <div
          key={row.label}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: u(8),
            height: u(rowHeight),
            borderBottom: index === rows.length - 1 ? 'none' : `1px solid ${LINE}`,
          }}
        >
          <span style={{ ...mono(8), color: MUTED }}>{row.label}</span>
          <span style={{ fontFamily: SANS, fontSize: u(valueSize), fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function roomArea(label: string): number {
  return Number.parseFloat(label.replace(',', '.')) || 1;
}

/**
 * Układ pomieszczeń ze skanu: prostokąty proporcjonalne do metrażu, ściany jak na rzucie.
 * Schemat powierzchni — nie odwzorowuje kształtu mieszkania.
 */
function RoomLayout({ rooms }: { rooms: Array<{ name: string; areaLabel: string }> }) {
  const sorted = [...rooms].sort((a, b) => roomArea(b.areaLabel) - roomArea(a.areaLabel));
  const total = sorted.reduce((sum, room) => sum + roomArea(room.areaLabel), 0);
  const top: typeof sorted = [];
  let acc = 0;
  for (const room of sorted) {
    if (top.length && (acc >= total * 0.55 || top.length >= 3)) break;
    top.push(room);
    acc += roomArea(room.areaLabel);
  }
  const rows = [top, sorted.slice(top.length)].filter((row) => row.length);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', border: `2.5px solid ${INK}`, boxSizing: 'border-box' }}>
      {rows.map((row, r) => (
        <div
          key={r}
          style={{
            display: 'flex',
            flex: row.reduce((sum, room) => sum + roomArea(room.areaLabel), 0),
            minHeight: 0,
            borderTop: r ? `1.5px solid ${INK}` : 'none',
          }}
        >
          {row.map((room, i) => (
            <div
              key={`${room.name}-${i}`}
              style={{
                flex: roomArea(room.areaLabel),
                minWidth: 0,
                borderLeft: i ? `1.5px solid ${INK}` : 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: u(3),
                textAlign: 'center',
                overflow: 'hidden',
              }}
            >
              <span style={{ fontFamily: SANS, fontSize: u(8.5), fontWeight: 600, lineHeight: 1.15 }}>{room.name}</span>
              <span style={{ fontFamily: MONO, fontSize: u(7.5), marginTop: u(1) }}>{room.areaLabel}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Rzut ze skanu (obraz), układ pomieszczeń albo mapa okolicy — co oferta ma. */
function PlanPanel({ data, title, style, dashed = false }: { data: SheetData; title: string; style?: CSSProperties; dashed?: boolean }) {
  const border = dashed ? `1px dashed #8e8a83` : `1px solid ${LINE}`;
  let body: ReactNode = null;
  let label = title;
  let total: string | null = null;
  if (data.plan?.kind === 'image') {
    body = <Img src={data.plan.src} style={{ objectFit: 'contain' }} />;
  } else if (data.plan?.kind === 'rooms') {
    total = data.plan.total;
    label = 'Pomieszczenia · skan LiDAR';
    body = <RoomLayout rooms={data.plan.rooms} />;
  } else if (data.map) {
    label = 'Położenie';
    body = <Img src={data.map} />;
  } else {
    return <Photo src={data.photos[0]} style={style} />;
  }
  return (
    <div style={{ border, padding: `${u(7)} ${u(10)}`, display: 'flex', flexDirection: 'column', minHeight: 0, boxSizing: 'border-box', ...style }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', ...mono(7.5), color: MUTED }}>
        <span>{label}</span>
        {total ? <span style={{ color: BLUE }}>razem {total}</span> : null}
      </div>
      <div style={{ flex: 1, minHeight: 0, marginTop: u(6), overflow: 'hidden' }}>{body}</div>
    </div>
  );
}

function Footer({ data, borderColor = INK, compactQrText = false }: { data: SheetData; borderColor?: string; compactQrText?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: u(14), borderTop: `2px solid ${borderColor}`, paddingTop: u(10) }}>
      {data.agent ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: u(10), minWidth: 0 }}>
          <Avatar agent={data.agent} size={40} />
          <div style={{ minWidth: 0 }}>
            <div style={{ ...mono(7.5), color: MUTED }}>{data.agent.role}</div>
            <div style={{ fontFamily: SANS, fontSize: u(13.5), fontWeight: 600, marginTop: u(1) }}>{data.agent.name}</div>
            <div style={{ fontFamily: MONO, fontSize: u(8.5), marginTop: u(1), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {[data.agent.company, data.agent.contact].filter(Boolean).join(' · ')}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ fontFamily: SANS, fontWeight: 600, letterSpacing: '0.3em', fontSize: u(10) }}>ESTATEOS™</div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: u(9), flexShrink: 0 }}>
        <span style={{ fontFamily: MONO, fontSize: u(8), color: MUTED, textAlign: 'right', lineHeight: 1.45 }}>
          {data.url}
          <br />
          {compactQrText ? 'pełna oferta' : 'galeria · mapa · termin'}
        </span>
        <Qr data={data} size={52} />
      </div>
    </div>
  );
}

function HeroBar({ data }: { data: SheetData }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: `${u(13)} ${u(24)}`,
        color: '#ffffff',
        textShadow: '0 1px 6px rgba(0,0,0,0.55)',
      }}
    >
      <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: u(10), letterSpacing: '0.3em' }}>ESTATEOS™</span>
      <span style={{ ...mono(8.5) }}>
        {data.ref} · {data.transaction}
      </span>
    </div>
  );
}

const page: CSSProperties = {
  position: 'relative',
  width: '794px',
  height: '1123px',
  boxSizing: 'border-box',
  overflow: 'hidden',
  background: '#ffffff',
  color: INK,
  fontFamily: SANS,
};

/* —— 1 · Galeria —— */
function Galeria({ data }: { data: SheetData }) {
  return (
    <div style={{ ...page, display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', height: u(318), flexShrink: 0 }}>
        <Photo src={data.hero} style={{ position: 'absolute', inset: 0 }} />
        <HeroBar data={data} />
      </div>
      <div style={{ flex: 1, padding: `${u(26)} ${u(32)} ${u(22)}`, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', ...mono(9.5, { letterSpacing: '0.12em', color: '#77736c' }) }}>
          <span>{data.kicker}</span>
          <span>{data.transaction}</span>
        </div>
        <h1 style={{ margin: `${u(10)} 0 0`, fontSize: u(27), fontWeight: 600, lineHeight: 1.12, letterSpacing: '-0.02em', maxHeight: u(62), overflow: 'hidden', flexShrink: 0 }}>{data.title}</h1>
        <p style={{ margin: `${u(6)} 0 0`, fontSize: u(12), color: '#55524c' }}>{data.address}</p>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: u(18), paddingBottom: u(16), borderBottom: `1px solid ${LINE}` }}>
          <span style={{ fontSize: u(40), fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1 }}>{data.price}</span>
          {data.ppsm ? <span style={{ fontSize: u(12), color: '#77736c' }}>{data.ppsm}</span> : null}
        </div>
        {data.big.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${data.big.length}, minmax(0, 1fr))`, gap: u(12), marginTop: u(16) }}>
            {data.big.map((item) => (
              <div key={item.label}>
                <div style={{ fontSize: u(22), fontWeight: 600 }}>{item.value}</div>
                <div style={{ fontSize: u(10), color: '#77736c', marginTop: u(2) }}>{item.label}</div>
              </div>
            ))}
          </div>
        ) : null}
        <div style={{ marginTop: u(16) }}>
          <Chips items={data.amenities} boxed={false} />
        </div>
        {data.description ? (
          <p style={{ margin: `${u(14)} 0 0`, fontSize: u(10.5), lineHeight: 1.5, color: INK_2, maxHeight: u(32), overflow: 'hidden', flexShrink: 0 }}>{data.description}</p>
        ) : null}
        {data.photos.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(3, data.photos.length)}, minmax(0, 1fr))`, gap: u(8), height: u(112), minHeight: u(84), flexShrink: 1, marginTop: u(12) }}>
            {data.photos.slice(0, 3).map((src) => (
              <Photo key={src} src={src} />
            ))}
          </div>
        ) : null}
        <div style={{ marginTop: 'auto', paddingTop: u(14) }}>
          <Footer data={data} borderColor={LINE} compactQrText />
        </div>
      </div>
    </div>
  );
}

function MapOrPhoto({ src, fallback }: { src: string | null; fallback: string | undefined }) {
  if (!src) return <Photo src={fallback} />;
  return (
    <div style={{ border: '1px dashed #8e8a83', overflow: 'hidden', position: 'relative' }}>
      <Img src={src} />
      <span style={{ position: 'absolute', left: u(8), top: u(6), ...mono(7.5), background: '#f3f1ec', padding: `${u(1)} ${u(4)}` }}>Położenie</span>
    </div>
  );
}

/* —— 3 · Architekt —— */
function Architekt({ data }: { data: SheetData }) {
  return (
    <div style={{ ...page, background: '#f3f1ec', padding: `${u(28)} ${u(30)} ${u(24)}`, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', borderTop: `2px solid ${INK}`, borderBottom: `1px solid ${INK}`, ...mono(9) }}>
        <div style={{ padding: `${u(7)} 0`, fontFamily: SANS, fontWeight: 600, letterSpacing: '0.24em' }}>EstateOS™</div>
        <div style={{ padding: `${u(7)} 0` }}>{data.ref}</div>
        <div style={{ padding: `${u(7)} 0`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.kicker.split(' · ').slice(-1)[0]}</div>
        <div style={{ padding: `${u(7)} 0`, textAlign: 'right', color: BLUE }}>{data.transaction}</div>
      </div>
      <h1 style={{ margin: `${u(18)} 0 0`, fontSize: u(25), fontWeight: 600, lineHeight: 1.15, letterSpacing: '-0.01em', maxWidth: u(470), maxHeight: u(58), overflow: 'hidden', flexShrink: 0 }}>{data.title}</h1>
      <p style={{ margin: `${u(6)} 0 0`, fontFamily: MONO, fontSize: u(10), color: MUTED }}>{data.address}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: u(14), marginTop: u(16), height: u(290) }}>
        <Photo src={data.hero} />
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <SpecTable rows={data.rows} rowHeight={25} valueSize={11} />
          <div style={{ marginTop: 'auto' }}>
            <div style={{ ...mono(9), color: BLUE }}>Cena</div>
            <div style={{ fontSize: u(27), fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.05 }}>{data.price}</div>
            {data.ppsm ? <div style={{ fontFamily: MONO, fontSize: u(9.5), color: MUTED, marginTop: u(2) }}>{data.ppsm}</div> : null}
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: u(14), marginTop: u(14), flex: 1, minHeight: 0, maxHeight: u(260) }}>
        {data.plan ? <PlanPanel data={data} title="Rzut mieszkania" dashed /> : <MapOrPhoto src={data.map} fallback={data.photos[0]} />}
        {data.plan ? <MapOrPhoto src={data.map} fallback={data.photos[0]} /> : <Photo src={data.map ? data.photos[0] : data.photos[1]} />}
      </div>
      <div style={{ marginTop: u(14) }}>
        <Chips items={data.amenities} boxed />
      </div>
      <div style={{ marginTop: 'auto' }}>
        <Footer data={data} />
      </div>
    </div>
  );
}

/* —— Pełna karta (połączenie Galerii i Architekta) —— */
function Pelna({ data }: { data: SheetData }) {
  return (
    <div style={{ ...page, display: 'grid', gridTemplateRows: `${u(236)} minmax(0, 1fr)` }}>
      <div style={{ position: 'relative' }}>
        <Photo src={data.hero} style={{ position: 'absolute', inset: 0 }} />
        <HeroBar data={data} />
      </div>
      <div style={{ padding: `${u(14)} ${u(24)}`, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ ...mono(8.5), color: BLUE }}>{data.kicker}</div>
        <h1 style={{ margin: `${u(5)} 0 0`, fontSize: u(21), fontWeight: 600, lineHeight: 1.14, letterSpacing: '-0.02em', maxHeight: u(48), overflow: 'hidden', flexShrink: 0 }}>{data.title}</h1>
        <p style={{ margin: `${u(3)} 0 0`, fontFamily: MONO, fontSize: u(9), color: MUTED }}>{data.address}</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 1fr)', gap: u(18), marginTop: u(10), borderTop: `2px solid ${INK}`, paddingTop: u(9) }}>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ ...mono(8), color: MUTED }}>Cena</div>
            <div style={{ fontSize: u(31), fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.05, marginTop: u(1) }}>{data.price}</div>
            {data.ppsm ? <div style={{ fontFamily: MONO, fontSize: u(9), color: MUTED, marginTop: u(2) }}>{data.ppsm}</div> : null}
            {data.description ? (
              <p style={{ margin: `${u(8)} 0 0`, fontSize: u(10), lineHeight: 1.48, color: INK_2, maxHeight: u(75), overflow: 'hidden', flexShrink: 0 }}>{data.description}</p>
            ) : null}
            <div style={{ marginTop: 'auto', paddingTop: u(7) }}>
              <Chips items={data.amenities} boxed />
            </div>
          </div>
          <SpecTable rows={data.rows} rowHeight={22} valueSize={12} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: u(10), marginTop: u(10), flex: 1, minHeight: 0 }}>
          <PlanPanel data={data} title="Rzut · skan LiDAR" />
          <div style={{ display: 'grid', gridTemplateRows: 'repeat(2, minmax(0, 1fr))', gap: u(8), minHeight: 0 }}>
            <Photo src={data.photos[0]} />
            <Photo src={data.photos[1]} />
          </div>
        </div>

        <div style={{ marginTop: u(10) }}>
          <Footer data={data} />
        </div>
      </div>
    </div>
  );
}

/**
 * Ofertówka na prezentację — jedna strona A4 w jednym z trzech stylów (wybór agenta).
 * Ten sam element trafia do podglądu, druku, PDF/JPEG i do aplikacji.
 */
export default function OfferSharePrintBrochure({ card, variant }: { card: OfferShareCard; variant: OfferSheetStyle }) {
  const data = sheetData(card);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const run = () => fitSheetText(el);
    run();
    void document.fonts?.ready.then(run);
  }, [card, variant]);
  return (
    <div ref={sheetRef} id="offer-share-print-brochure" className={offerFontVars} style={{ width: '794px', height: '1123px' }}>
      {variant === 'galeria' ? <Galeria data={data} /> : variant === 'architekt' ? <Architekt data={data} /> : <Pelna data={data} />}
    </div>
  );
}

const SHEET_W = 794;
const SHEET_H = 1123;

/** Podgląd kartki dopasowany do szerokości kontenera (eksport i tak bierze naturalny rozmiar). */
export function OfferSheetFit({ card, variant, maxScale = 1 }: { card: OfferShareCard; variant: OfferSheetStyle; maxScale?: number }) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.4);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const fit = () => {
      const next = Math.min(maxScale, box.clientWidth / SHEET_W);
      if (Number.isFinite(next) && next > 0.05) setScale(next);
    };
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    return () => observer.disconnect();
  }, [maxScale]);

  return (
    <div ref={boxRef} style={{ width: '100%' }}>
      <div style={{ width: SHEET_W * scale, height: SHEET_H * scale, margin: '0 auto', overflow: 'hidden', boxShadow: '0 18px 50px rgba(0,0,0,0.28)' }}>
        <div data-offer-sheet-fit style={{ width: SHEET_W, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <OfferSharePrintBrochure card={card} variant={variant} />
        </div>
      </div>
    </div>
  );
}

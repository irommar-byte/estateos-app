import type { ReactNode } from 'react';
import type { RoomScanObjectCategory } from '@/types/roomScan';

/** Symbole mebli jak na rysunku architektonicznym (te same co na rzutach z aplikacji). Rysowane w środku (0,0). */
const INK = '#1f2937';
const SOFT = '#94a3b8';

function sofa(w: number, h: number) {
  const x = -w / 2;
  const y = -h / 2;
  const inset = Math.max(2, Math.min(w, h) * 0.06);
  const arm = Math.max(4, w * 0.045);
  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx={3} fill="#fff" stroke={INK} strokeWidth={1.3} />
      <rect x={x + inset} y={y + inset} width={w / 2 - inset * 1.5} height={h * 0.25} rx={Math.min(8, h * 0.12)} fill="#fff" stroke={INK} strokeWidth={0.9} />
      <rect x={inset * 0.5} y={y + inset} width={w / 2 - inset * 1.5} height={h * 0.25} rx={Math.min(8, h * 0.12)} fill="#fff" stroke={INK} strokeWidth={0.9} />
      <line x1={0} y1={y + h * 0.28} x2={0} y2={y + h - inset} stroke={INK} strokeWidth={0.9} />
      <rect x={x} y={y} width={arm} height={h} fill="#fff" stroke={INK} strokeWidth={1} />
      <rect x={x + w - arm} y={y} width={arm} height={h} fill="#fff" stroke={INK} strokeWidth={1} />
    </>
  );
}

function bed(w: number, h: number) {
  const x = -w / 2;
  const y = -h / 2;
  const inset = Math.max(2, Math.min(w, h) * 0.045);
  const pillowH = Math.max(8, h * 0.18);
  const double = w > h * 0.6;
  return (
    <>
      <rect x={x} y={y} width={w} height={h} rx={2} fill="#fff" stroke={INK} strokeWidth={1.3} />
      {double ? (
        <>
          <rect x={x + inset} y={y + inset} width={w / 2 - inset * 1.5} height={pillowH} rx={pillowH * 0.35} fill="#fff" stroke={INK} strokeWidth={0.9} />
          <rect x={inset * 0.5} y={y + inset} width={w / 2 - inset * 1.5} height={pillowH} rx={pillowH * 0.35} fill="#fff" stroke={INK} strokeWidth={0.9} />
        </>
      ) : (
        <rect x={x + inset} y={y + inset} width={w - inset * 2} height={pillowH} rx={pillowH * 0.35} fill="#fff" stroke={INK} strokeWidth={0.9} />
      )}
      <path d={`M ${x} ${y + h * 0.36} L ${x + w} ${y + h * 0.36}`} stroke={INK} strokeWidth={0.9} />
      <path d={`M ${x} ${y + h * 0.36} L ${x + w * 0.22} ${y + h * 0.44} L ${x + w} ${y + h * 0.44}`} fill="none" stroke={SOFT} strokeWidth={0.8} />
    </>
  );
}

function table(w: number, h: number) {
  return <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={3} fill="#fff" stroke={INK} strokeWidth={1.2} />;
}

function chair(size: number) {
  const s = size * 0.42;
  return (
    <>
      <rect x={-s} y={-s} width={s * 2} height={s * 2} rx={s * 0.35} fill="#fff" stroke={INK} strokeWidth={1.1} />
      <path d={`M ${-s} ${-s * 0.55} L ${s} ${-s * 0.55}`} stroke={INK} strokeWidth={1} />
    </>
  );
}

function stove(w: number, h: number) {
  const r = Math.max(2.5, Math.min(w, h) * 0.12);
  return (
    <>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={2} fill="#fff" stroke={INK} strokeWidth={1.2} />
      {[-0.22, 0.22].map((xr) => [-0.22, 0.22].map((yr) => <circle key={`${xr}${yr}`} cx={w * xr} cy={h * yr} r={r} fill="none" stroke={INK} strokeWidth={0.9} />))}
    </>
  );
}

function storage(w: number, h: number) {
  return (
    <>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} fill="#fff" stroke={INK} strokeWidth={1.2} />
      <path d={`M ${-w / 2} ${-h / 2} L ${w / 2} ${h / 2}`} stroke={SOFT} strokeWidth={0.7} />
    </>
  );
}

function appliance(w: number, h: number, mark: string) {
  return (
    <>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={2} fill="#fff" stroke={INK} strokeWidth={1.2} />
      <text x={0} y={Math.min(w, h) * 0.14} fontSize={Math.max(7, Math.min(w, h) * 0.38)} fontWeight={700} fill={SOFT} textAnchor="middle">{mark}</text>
    </>
  );
}

function sink(w: number, h: number) {
  return (
    <>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={3} fill="#fff" stroke={INK} strokeWidth={1.2} />
      <ellipse cx={0} cy={h * 0.06} rx={w * 0.32} ry={h * 0.28} fill="none" stroke={INK} strokeWidth={0.9} />
    </>
  );
}

function bathtub(w: number, h: number) {
  const r = Math.min(w, h) * 0.18;
  const i = Math.min(w, h) * 0.12;
  return (
    <>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={r * 0.6} fill="#fff" stroke={INK} strokeWidth={1.2} />
      <rect x={-w / 2 + i} y={-h / 2 + i} width={w - i * 2} height={h - i * 2} rx={r} fill="#f1f7fb" stroke={INK} strokeWidth={0.9} />
    </>
  );
}

function toilet(w: number, h: number) {
  return (
    <>
      <rect x={-w * 0.48} y={-h / 2} width={w * 0.96} height={h * 0.28} rx={2} fill="#fff" stroke={INK} strokeWidth={1.1} />
      <ellipse cx={0} cy={h * 0.12} rx={w * 0.42} ry={h * 0.34} fill="#fff" stroke={INK} strokeWidth={1.1} />
    </>
  );
}

function television(w: number, h: number) {
  return <rect x={-w / 2} y={-h / 2} width={w} height={Math.max(4, h * 0.5)} rx={1} fill={INK} opacity={0.75} />;
}

export function planFurnitureSymbol(category: RoomScanObjectCategory, w: number, h: number): ReactNode {
  switch (category) {
    case 'sofa':
      return sofa(w, h);
    case 'bed':
      return bed(w, h);
    case 'table':
      return table(w, h);
    case 'chair':
      return chair(Math.max(w, h));
    case 'stove':
    case 'oven':
      return stove(w, h);
    case 'refrigerator':
      return appliance(w, h, 'L');
    case 'dishwasher':
      return appliance(w, h, 'Z');
    case 'washerDryer':
      return appliance(w, h, 'P');
    case 'sink':
      return sink(w, h);
    case 'bathtub':
      return bathtub(w, h);
    case 'toilet':
      return toilet(w, h);
    case 'television':
      return television(w, h);
    case 'storage':
    default:
      return storage(w, h);
  }
}

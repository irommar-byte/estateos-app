import React from 'react';
import { G, Line, Rect, Circle, Path } from 'react-native-svg';
import type { MappedObject } from './floorPlanGeometry';

function snapOrthogonalRotation(deg: number) {
  const normalized = ((deg % 360) + 360) % 360;
  const snapped = Math.round(normalized / 90) * 90;
  return snapped % 360;
}

function SofaSymbol({ cx, cy, w, h }: { cx: number; cy: number; w: number; h: number }) {
  const x = cx - w / 2;
  const y = cy - h / 2;
  const midX = cx;
  const inset = Math.max(2, Math.min(w, h) * 0.06);
  return (
    <G>
      <Rect x={x} y={y} width={w} height={h} fill="#ffffff" stroke="#111827" strokeWidth={1.3} />
      <Rect
        x={x + inset}
        y={y + inset}
        width={w / 2 - inset * 1.5}
        height={h * 0.25}
        rx={Math.min(8, h * 0.12)}
        fill="#ffffff"
        stroke="#111827"
        strokeWidth={0.9}
      />
      <Rect
        x={midX + inset * 0.5}
        y={y + inset}
        width={w / 2 - inset * 1.5}
        height={h * 0.25}
        rx={Math.min(8, h * 0.12)}
        fill="#ffffff"
        stroke="#111827"
        strokeWidth={0.9}
      />
      <Line x1={midX} y1={y + h * 0.28} x2={midX} y2={y + h - inset} stroke="#111827" strokeWidth={1} />
      {[x + w * 0.25, x + w * 0.75].map((px) => (
        <G key={px}>
          <Line x1={px - w * 0.08} y1={y + h * 0.47} x2={px + w * 0.08} y2={y + h * 0.72} stroke="#6b7280" strokeWidth={0.8} />
          <Line x1={px - w * 0.08} y1={y + h * 0.72} x2={px + w * 0.08} y2={y + h * 0.47} stroke="#6b7280" strokeWidth={0.8} />
        </G>
      ))}
      <Rect x={x - 2} y={y} width={Math.max(4, w * 0.045)} height={h} fill="#ffffff" stroke="#111827" strokeWidth={1} />
      <Rect x={x + w - Math.max(4, w * 0.045) + 2} y={y} width={Math.max(4, w * 0.045)} height={h} fill="#ffffff" stroke="#111827" strokeWidth={1} />
    </G>
  );
}

function TelevisionSymbol({ cx, cy, w, h }: { cx: number; cy: number; w: number; h: number }) {
  const consoleH = h;
  const consoleW = w;
  const screenW = consoleW * 0.72;
  const screenH = consoleH * 0.38;
  return (
    <G>
      <Rect
        x={cx - consoleW / 2}
        y={cy - consoleH / 2}
        width={consoleW}
        height={consoleH}
        fill="#ffffff"
        stroke="#111827"
        strokeWidth={1.3}
      />
      <Rect
        x={cx - screenW / 2}
        y={cy - screenH / 2}
        width={screenW}
        height={screenH}
        fill="#ffffff"
        stroke="#111827"
        strokeWidth={1}
      />
      <Path
        d={`M ${cx - screenW * 0.36} ${cy + screenH * 0.12} L ${cx - screenW * 0.28} ${cy + screenH * 0.28} L ${cx + screenW * 0.28} ${cy + screenH * 0.28} L ${cx + screenW * 0.36} ${cy + screenH * 0.12}`}
        fill="none"
        stroke="#111827"
        strokeWidth={1}
      />
    </G>
  );
}

function TableSymbol({ cx, cy, w, h }: { cx: number; cy: number; w: number; h: number }) {
  return (
    <G>
      <Rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} fill="#ffffff" stroke="#111827" strokeWidth={1.2} />
      <Circle cx={cx - w * 0.22} cy={cy - h * 0.15} r={Math.max(2, w * 0.08)} fill="none" stroke="#111827" strokeWidth={0.9} />
      <Circle cx={cx + w * 0.22} cy={cy - h * 0.15} r={Math.max(2, w * 0.08)} fill="none" stroke="#111827" strokeWidth={0.9} />
    </G>
  );
}

function ChairSymbol({ cx, cy, size }: { cx: number; cy: number; size: number }) {
  const r = size * 0.34;
  return (
    <G>
      <Circle cx={cx} cy={cy} r={r} fill="#ffffff" stroke="#111827" strokeWidth={1.2} />
      <Path
        d={`M ${cx - size * 0.45} ${cy + size * 0.16} Q ${cx} ${cy + size * 0.56} ${cx + size * 0.45} ${cy + size * 0.16}`}
        fill="none"
        stroke="#111827"
        strokeWidth={1.2}
        strokeLinecap="round"
      />
    </G>
  );
}

function BedSymbol({ cx, cy, w, h }: { cx: number; cy: number; w: number; h: number }) {
  const x = cx - w / 2;
  const y = cy - h / 2;
  const inset = Math.max(2, Math.min(w, h) * 0.045);
  const pillowH = Math.max(8, h * 0.2);
  return (
    <G>
      <Rect x={x} y={y} width={w} height={h} fill="#ffffff" stroke="#111827" strokeWidth={1.3} />
      <Line x1={cx} y1={y + inset} x2={cx} y2={y + h - inset} stroke="#111827" strokeWidth={0.9} />
      <Rect x={x + inset} y={y + inset} width={w / 2 - inset * 1.5} height={pillowH} rx={pillowH * 0.35} fill="#ffffff" stroke="#111827" strokeWidth={0.9} />
      <Rect x={cx + inset * 0.5} y={y + inset} width={w / 2 - inset * 1.5} height={pillowH} rx={pillowH * 0.35} fill="#ffffff" stroke="#111827" strokeWidth={0.9} />
      {[x + w * 0.25, x + w * 0.75].map((px) =>
        [y + h * 0.48, y + h * 0.76].map((py) => (
          <G key={`${px}-${py}`}>
            <Line x1={px - w * 0.035} y1={py - h * 0.055} x2={px + w * 0.035} y2={py + h * 0.055} stroke="#6b7280" strokeWidth={0.75} />
            <Line x1={px - w * 0.035} y1={py + h * 0.055} x2={px + w * 0.035} y2={py - h * 0.055} stroke="#6b7280" strokeWidth={0.75} />
          </G>
        )),
      )}
    </G>
  );
}

function StoveSymbol({ cx, cy, w, h }: { cx: number; cy: number; w: number; h: number }) {
  return (
    <G>
      <Rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} fill="#ffffff" stroke="#111827" strokeWidth={1.2} />
      {[0.3, 0.7].map((xr) =>
        [0.32, 0.68].map((yr) => (
          <Circle
            key={`${xr}-${yr}`}
            cx={cx - w / 2 + w * xr}
            cy={cy - h / 2 + h * yr}
            r={Math.max(2.5, Math.min(w, h) * 0.09)}
            fill="none"
            stroke="#111827"
            strokeWidth={1}
          />
        )),
      )}
    </G>
  );
}

function StorageSymbol({ cx, cy, w, h }: { cx: number; cy: number; w: number; h: number }) {
  return (
    <Rect
      x={cx - w / 2}
      y={cy - h / 2}
      width={w}
      height={h}
      fill="#ffffff"
      stroke="#111827"
      strokeWidth={1.2}
    />
  );
}

function SinkSymbol({ cx, cy, w, h }: { cx: number; cy: number; w: number; h: number }) {
  return (
    <G>
      <Rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} fill="#ffffff" stroke="#111827" strokeWidth={1.2} />
      <Circle cx={cx} cy={cy} r={Math.min(w, h) * 0.22} fill="none" stroke="#111827" strokeWidth={0.9} />
    </G>
  );
}

function BathtubSymbol({ cx, cy, w, h }: { cx: number; cy: number; w: number; h: number }) {
  const rx = Math.min(w, h) * 0.18;
  return (
    <Rect
      x={cx - w / 2}
      y={cy - h / 2}
      width={w}
      height={h}
      rx={rx}
      fill="#ffffff"
      stroke="#111827"
      strokeWidth={1.2}
    />
  );
}

function ToiletSymbol({ cx, cy, size }: { cx: number; cy: number; size: number }) {
  const r = size * 0.28;
  return (
    <G>
      <Rect
        x={cx - size * 0.22}
        y={cy - size * 0.42}
        width={size * 0.44}
        height={size * 0.55}
        fill="#ffffff"
        stroke="#111827"
        strokeWidth={1.1}
      />
      <Circle cx={cx} cy={cy + size * 0.18} r={r} fill="#ffffff" stroke="#111827" strokeWidth={1.1} />
    </G>
  );
}

export function ArchitecturalFurnitureSymbol({ obj }: { obj: MappedObject }) {
  const rot = snapOrthogonalRotation(obj.rotationDeg || 0);
  const cx = obj.x;
  const cy = obj.y;
  const w = obj.widthPx;
  const h = obj.depthPx;

  const body = (() => {
    switch (obj.category) {
      case 'sofa':
        return <SofaSymbol cx={0} cy={0} w={w} h={h} />;
      case 'television':
        return <TelevisionSymbol cx={0} cy={0} w={w} h={h} />;
      case 'table':
        return <TableSymbol cx={0} cy={0} w={w} h={h} />;
      case 'chair':
        return <ChairSymbol cx={0} cy={0} size={Math.max(w, h)} />;
      case 'bed':
        return <BedSymbol cx={0} cy={0} w={w} h={h} />;
      case 'stove':
      case 'oven':
        return <StoveSymbol cx={0} cy={0} w={w} h={h} />;
      case 'storage':
      case 'refrigerator':
      case 'dishwasher':
      case 'washerDryer':
        return <StorageSymbol cx={0} cy={0} w={w} h={h} />;
      case 'sink':
        return <SinkSymbol cx={0} cy={0} w={w} h={h} />;
      case 'bathtub':
        return <BathtubSymbol cx={0} cy={0} w={w} h={h} />;
      case 'toilet':
        return <ToiletSymbol cx={0} cy={0} size={Math.max(w, h)} />;
      default:
        return <StorageSymbol cx={0} cy={0} w={Math.max(w, 18)} h={Math.max(h, 14)} />;
    }
  })();

  return (
    <G transform={`translate(${cx} ${cy}) rotate(${rot})`}>
      {body}
    </G>
  );
}

'use client';

import { useMemo } from 'react';
import type { Locale } from '@/i18n/config';
import type { FloorPlanScanMeta, RoomScanWallSegment } from '@/types/roomScan';
import {
  buildCleanPlanDimensions,
  buildFloorPlanViewport,
  buildWallRenderPaths,
  mapFloorPlanPoint,
  mapOpeningsForRender,
  mapSectionsForRender,
} from '@/lib/roomScan/floorPlanGeometry';
import { detectPlanRooms, placePlanObjects, planLabelSpot } from '@/lib/roomScan/planNormalize';
import { planFurnitureSymbol } from '@/components/offers/planFurnitureSymbols';

/** Delikatne tła pomieszczeń (jak na rzutach architektonicznych). */
const ROOM_TINT: Record<string, string> = {
  livingRoom: '#fdf6ec',
  bedroom: '#f1f5fd',
  room: '#f3f7f1',
  bathroom: '#eef6fb',
  kitchen: '#fbf3ee',
  hallway: '#f6f6f4',
};

type Props = {
  walls: RoomScanWallSegment[];
  meta: FloorPlanScanMeta;
  width: number;
  height: number;
  locale: Locale;
  className?: string;
  compact?: boolean;
  /** Klik w pomieszczenie na planie (nazwa jak w skanie: „Salon”, „Łazienka”…). */
  onRoomClick?: (label: string) => void;
  /** Podświetlone pomieszczenie (np. pokój ze zdjęcia w galerii). */
  highlight?: string | null;
  /** Mapa ciepła zainteresowania: nazwa pomieszczenia → 0…1. */
  heat?: Record<string, number> | null;
};

export default function FloorPlanScanArtboard({ walls, meta, width, height, locale, className, compact, onRoomClick, highlight, heat }: Props) {
  const padding = compact ? 8 : 48;
  const bg = compact ? '#eef2f6' : '#eef2f6';

  const viewport = useMemo(
    () => buildFloorPlanViewport(meta.bounds, width, height, padding),
    [meta.bounds, width, height, padding],
  );

  const wallPaths = useMemo(
    () => buildWallRenderPaths(walls, meta.bounds, viewport),
    [walls, meta.bounds, viewport],
  );

  const mappedSections = useMemo(
    () => mapSectionsForRender(meta.sections, meta.bounds, viewport, locale),
    [meta.sections, meta.bounds, viewport, locale],
  );

  const mappedOpenings = useMemo(
    () => mapOpeningsForRender(meta.openings, meta.bounds, viewport),
    [meta.openings, meta.bounds, viewport],
  );


  const planRooms = useMemo(() => detectPlanRooms(meta), [meta]);
  const roomPaths = useMemo(
    () =>
      planRooms.map((room) => ({
        id: room.id,
        label: room.label,
        fill: ROOM_TINT[room.key] || '#f8fafc',
        d: room.rects
          .map(([x0, z0, x1, z1]) => {
            const a = mapFloorPlanPoint(x0, z0, meta.bounds, viewport);
            const b = mapFloorPlanPoint(x1, z1, meta.bounds, viewport);
            return `M${a.x.toFixed(1)} ${a.y.toFixed(1)}H${b.x.toFixed(1)}V${b.y.toFixed(1)}H${a.x.toFixed(1)}Z`;
          })
          .join(''),
      })),
    [planRooms, meta.bounds, viewport],
  );

  // Rzut „ubrany”: meble ze skanu, równo przy ścianach, w swoich pomieszczeniach.
  const furniture = useMemo(() => (compact ? [] : placePlanObjects(meta, planRooms)), [compact, meta, planRooms]);

  const scaleBar = useMemo(() => {
    const targetPx = 72;
    const niceMeters = [1, 2, 3, 5, 10].find((m) => m * viewport.scale >= targetPx * 0.75) || 1;
    return { meters: niceMeters, px: niceMeters * viewport.scale };
  }, [viewport.scale]);

  const drawH = height;

  const wallW = Math.max(compact ? 3 : 4.5, Math.min(compact ? 6 : 9, viewport.scale * 0.13));
  // Plan rysuje się w ~960 px i jest pomniejszany na stronie — litery liczymy z zapasem.
  const nameSize = compact ? 0 : Math.max(15, Math.min(24, viewport.scale * 0.3));

  // Etykiety pomieszczeń: na środku pokoju, bez nachodzenia (kolejna zsuwa się w dół).
  const roomLabels = useMemo(() => {
    const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
    const source = planRooms.length
      ? planRooms
          .filter((room) => room.label)
          .map((room) => {
            const small = room.areaSqM > 0 && room.areaSqM < 6.5;
            const size = small ? nameSize * 0.78 : nameSize;
            const wM = (Math.max(room.label.length * size * 0.6, 40) + 12) / viewport.scale;
            const hM = (size * 2.4) / viewport.scale;
            const spot = planLabelSpot(room, wM, hM, furniture);
            return { id: room.id, label: room.label, areaSqM: room.areaSqM, ...mapFloorPlanPoint(spot.x, spot.z, meta.bounds, viewport) };
          })
      : mappedSections;
    return source.map((section) => {
      const small = (section.areaSqM || 0) > 0 && (section.areaSqM || 0) < 6.5;
      const size = small ? nameSize * 0.78 : nameSize;
      const w = Math.max(section.label.length * size * 0.58, 40);
      const h = section.areaSqM ? size * 2.3 : size * 1.3;
      let y = section.y;
      for (let i = 0; i < 4; i += 1) {
        const hit = placed.some((p) => Math.abs(p.x - section.x) < (p.w + w) / 2 && Math.abs(p.y - y) < (p.h + h) / 2);
        if (!hit) break;
        y += h * 0.9;
      }
      placed.push({ x: section.x, y, w, h });
      return { ...section, y, size };
    });
  }, [mappedSections, nameSize, planRooms, furniture, meta.bounds, viewport]);

  const dimensionLabels = useMemo(
    () =>
      buildCleanPlanDimensions(
        walls,
        meta.openings || [],
        meta.bounds,
        viewport,
        roomLabels.map((label) => ({ x: label.x, y: label.y })),
      ),
    [walls, meta.openings, meta.bounds, viewport, roomLabels],
  );

  const ink = '#1e293b';
  const halo = { stroke: '#ffffff', strokeWidth: 4, paintOrder: 'stroke' as const, strokeLinejoin: 'round' as const };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="100%"
      className={`eos-plan-svg ${className || ''}`}
      role="img"
      aria-label="Plan mieszkania ze skanu LiDAR"
      style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif' }}
    >
      <rect x={0} y={0} width={width} height={height} fill={bg} rx={compact ? 10 : 24} />

      {wallPaths.map((path) =>
        path.d.includes(' Z') ? <path key={`${path.id}-fill`} d={path.d} fill="#ffffff" stroke="none" /> : null,
      )}

      {roomPaths.map((room) => {
        const norm = (v: string | null | undefined) => String(v || '').trim().toLocaleLowerCase('pl');
        const lit = Boolean(highlight) && norm(highlight) === norm(room.label);
        const heatValue = heat ? heat[norm(room.label)] ?? 0 : 0;
        return (
          <g key={room.id}>
            <path d={room.d} fill={room.fill} stroke={room.fill} strokeWidth={0.6} />
            {heat && heatValue > 0 ? (
              <path d={room.d} fill={`rgba(234, 88, 12, ${(0.12 + heatValue * 0.5).toFixed(2)})`} className="eos-plan-heat" />
            ) : null}
            {lit ? <path d={room.d} className="eos-plan-room-lit" /> : null}
            {onRoomClick && room.label ? (
              <path
                d={room.d}
                className="eos-plan-room-hit"
                onClick={(event) => {
                  event.stopPropagation();
                  onRoomClick(room.label);
                }}
              >
                <title>{room.label}</title>
              </path>
            ) : null}
          </g>
        );
      })}

      {furniture.map((obj) => {
        const p = mapFloorPlanPoint(obj.centerX, obj.centerZ, meta.bounds, viewport);
        return (
          <g key={obj.id} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${obj.rotationDeg})`} opacity={0.92} pointerEvents="none">
            {planFurnitureSymbol(obj.category, obj.widthM * viewport.scale, obj.depthM * viewport.scale)}
          </g>
        );
      })}

      {wallPaths.map((path) => (
        <path key={path.id} d={path.d} fill="none" stroke={ink} strokeWidth={wallW} strokeLinecap="square" strokeLinejoin="miter" />
      ))}

      {mappedOpenings.map((opening) => {
        const dx = opening.b.x - opening.a.x;
        const dy = opening.b.y - opening.a.y;
        const len = Math.hypot(dx, dy) || 1;
        return (
          <g key={opening.id}>
            <line x1={opening.a.x} y1={opening.a.y} x2={opening.b.x} y2={opening.b.y} stroke="#ffffff" strokeWidth={wallW + 1.5} />
            {opening.kind === 'window' ? (
              <>
                <line x1={opening.a.x} y1={opening.a.y} x2={opening.b.x} y2={opening.b.y} stroke="#0284c7" strokeWidth={wallW * 0.9} strokeOpacity={0.25} />
                <line x1={opening.a.x} y1={opening.a.y} x2={opening.b.x} y2={opening.b.y} stroke="#0284c7" strokeWidth={1.4} />
              </>
            ) : opening.kind === 'door' && !compact ? (
              <path
                d={`M ${opening.a.x} ${opening.a.y} L ${opening.a.x - (dy / len) * len} ${opening.a.y + (dx / len) * len} A ${len} ${len} 0 0 0 ${opening.b.x} ${opening.b.y}`}
                fill="none"
                stroke="#94a3b8"
                strokeWidth={1}
              />
            ) : null}
          </g>
        );
      })}

      {compact
        ? null
        : dimensionLabels
            .filter((label) => !roomLabels.some((room) => Math.abs(room.x - label.x) < room.label.length * room.size * 0.36 + 18 && label.y > room.y - room.size * 1.4 && label.y < room.y + room.size * 1.6))
            .map((label) => {
            const color = label.kind === 'window' ? '#0369a1' : label.kind === 'door' ? '#b45309' : '#475569';
            return (
              <text key={label.id} x={label.x} y={label.y + 3.5} fill={color} fontSize={13} fontWeight={600} textAnchor="middle" {...halo}>
                {label.text}
              </text>
            );
          })}

      {compact
        ? mappedSections.map((section) => <circle key={`${section.id}-dot`} cx={section.x} cy={section.y} r={3.5} fill="#0ea5e9" opacity={0.6} />)
        : roomLabels.map((section) => (
            <g key={`${section.id}-label`}>
              <text x={section.x} y={section.areaSqM ? section.y - section.size * 0.15 : section.y + section.size * 0.35} fill={ink} fontSize={section.size} fontWeight={700} textAnchor="middle" {...halo}>
                {section.label}
              </text>
              {section.areaSqM ? (
                <text x={section.x} y={section.y + section.size * 1.05} fill="#0369a1" fontSize={section.size * 0.82} fontWeight={600} textAnchor="middle" {...halo}>
                  {section.areaSqM} m²
                </text>
              ) : null}
            </g>
          ))}

      {!compact && meta.northRotationDegrees != null && Number.isFinite(meta.northRotationDegrees) ? (
        <g transform={`translate(${width - padding + 4} ${padding + 6})`} className="eos-plan-compass">
          <circle r={22} fill="#ffffff" stroke="#cbd5e1" strokeWidth={1} />
          <g transform={`rotate(${meta.northRotationDegrees})`}>
            <path d="M0 -17 L5 0 L0 4 L-5 0 Z" fill="#b91c1c" />
            <path d="M0 17 L5 0 L0 -4 L-5 0 Z" fill="#94a3b8" />
            <text y={-24} textAnchor="middle" fontSize={11} fontWeight={700} fill="#b91c1c" transform={`rotate(${-meta.northRotationDegrees} 0 -28)`}>
              N
            </text>
          </g>
        </g>
      ) : null}

      {compact ? null : (
        <g>
          <line x1={padding} y1={drawH - padding + 8} x2={padding + scaleBar.px} y2={drawH - padding + 8} stroke={ink} strokeWidth={2} />
          <line x1={padding} y1={drawH - padding + 3} x2={padding} y2={drawH - padding + 13} stroke={ink} strokeWidth={2} />
          <line x1={padding + scaleBar.px} y1={drawH - padding + 3} x2={padding + scaleBar.px} y2={drawH - padding + 13} stroke={ink} strokeWidth={2} />
          <text x={padding + scaleBar.px / 2} y={drawH - padding - 1} fill={ink} fontSize={13} fontWeight={600} textAnchor="middle">
            {scaleBar.meters} m
          </text>
        </g>
      )}
    </svg>
  );
}

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
import { detectPlanRooms } from '@/lib/roomScan/planNormalize';

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
};

export default function FloorPlanScanArtboard({ walls, meta, width, height, locale, className, compact }: Props) {
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

  const dimensionLabels = useMemo(
    () =>
      buildCleanPlanDimensions(
        walls,
        meta.openings || [],
        meta.bounds,
        viewport,
        mappedSections.map((section) => ({ x: section.x, y: section.y })),
      ),
    [walls, meta.openings, meta.bounds, viewport, mappedSections],
  );

  const planRooms = useMemo(() => detectPlanRooms(meta), [meta]);
  const roomPaths = useMemo(
    () =>
      planRooms.map((room) => ({
        id: room.id,
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
          .map((room) => ({ id: room.id, label: room.label, areaSqM: room.areaSqM, ...mapFloorPlanPoint(room.labelX, room.labelZ, meta.bounds, viewport) }))
      : mappedSections;
    return source.map((section) => {
      const small = (section.areaSqM || 0) > 0 && (section.areaSqM || 0) < 4;
      const size = small ? nameSize * 0.82 : nameSize;
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
  }, [mappedSections, nameSize, planRooms, meta.bounds, viewport]);

  const ink = '#1e293b';
  const halo = { stroke: '#ffffff', strokeWidth: 4, paintOrder: 'stroke' as const, strokeLinejoin: 'round' as const };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="100%"
      className={className}
      role="img"
      aria-label="Plan mieszkania ze skanu LiDAR"
      style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif' }}
    >
      <rect x={0} y={0} width={width} height={height} fill={bg} rx={compact ? 10 : 24} />

      {wallPaths.map((path) =>
        path.d.includes(' Z') ? <path key={`${path.id}-fill`} d={path.d} fill="#ffffff" stroke="none" /> : null,
      )}

      {roomPaths.map((room) => (
        <path key={room.id} d={room.d} fill={room.fill} stroke={room.fill} strokeWidth={0.6} />
      ))}

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
        : dimensionLabels.map((label) => {
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

'use client';

import { useMemo } from 'react';
import type { Locale } from '@/i18n/config';
import type { FloorPlanScanMeta, RoomScanWallSegment } from '@/types/roomScan';
import {
  buildFloorPlanViewport,
  formatWallDimension,
  mapSectionsForRender,
  mapWallsForRender,
  sectionMarkerRadiusPx,
} from '@/lib/roomScan/floorPlanGeometry';

type Props = {
  walls: RoomScanWallSegment[];
  meta: FloorPlanScanMeta;
  width: number;
  height: number;
  locale: Locale;
  className?: string;
};

export default function FloorPlanScanArtboard({ walls, meta, width, height, locale, className }: Props) {
  const padding = 36;
  const bg = '#0b1220';

  const viewport = useMemo(
    () => buildFloorPlanViewport(meta.bounds, width, height, padding),
    [meta.bounds, width, height],
  );

  const mappedWalls = useMemo(
    () => mapWallsForRender(walls, meta.bounds, viewport, false),
    [walls, meta.bounds, viewport],
  );

  const mappedSections = useMemo(
    () => mapSectionsForRender(meta.sections, meta.bounds, viewport, locale),
    [meta.sections, meta.bounds, viewport, locale],
  );

  const scaleBar = useMemo(() => {
    const targetPx = 72;
    const niceMeters = [1, 2, 3, 5, 10].find((m) => m * viewport.scale >= targetPx * 0.75) || 1;
    return { meters: niceMeters, px: niceMeters * viewport.scale };
  }, [viewport.scale]);

  const drawH = height;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height="100%"
      className={className}
      role="img"
      aria-label="Interactive LiDAR floor plan"
    >
      <rect x={0} y={0} width={width} height={height} fill={bg} rx={24} />

      {mappedSections.map((section) => {
        const r = sectionMarkerRadiusPx(viewport, section.areaSqM);
        return (
          <g key={section.id}>
            <circle cx={section.x} cy={section.y} r={r} fill={section.fill} />
            <circle
              cx={section.x}
              cy={section.y}
              r={r}
              fill="none"
              stroke="rgba(56,189,248,0.22)"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          </g>
        );
      })}

      {mappedWalls.map((wall) => (
        <g key={wall.id}>
          <line
            x1={wall.a.x}
            y1={wall.a.y}
            x2={wall.b.x}
            y2={wall.b.y}
            stroke="#0f172a"
            strokeWidth={12}
            strokeLinecap="square"
          />
          <line
            x1={wall.a.x}
            y1={wall.a.y}
            x2={wall.b.x}
            y2={wall.b.y}
            stroke="#e2e8f0"
            strokeWidth={2}
            strokeLinecap="square"
          />
          {wall.showLabel ? (
            <g>
              <rect
                x={wall.lx - 28}
                y={wall.ly - 11}
                width={56}
                height={20}
                rx={10}
                fill="rgba(15,23,42,0.94)"
                stroke="rgba(148,163,184,0.35)"
                strokeWidth={0.5}
              />
              <text
                x={wall.lx}
                y={wall.ly + 4}
                fill="#f1f5f9"
                fontSize={8}
                fontWeight={700}
                textAnchor="middle"
              >
                {formatWallDimension(wall.len)}
              </text>
            </g>
          ) : null}
        </g>
      ))}

      {mappedSections.map((section) => (
        <g key={`${section.id}-label`}>
          <rect
            x={section.x - 54}
            y={section.y - 22}
            width={108}
            height={section.areaSqM ? 40 : 24}
            rx={12}
            fill="rgba(15,23,42,0.88)"
            stroke="rgba(56,189,248,0.35)"
            strokeWidth={1}
          />
          <text x={section.x} y={section.y - 4} fill="#f8fafc" fontSize={10} fontWeight={800} textAnchor="middle">
            {section.label}
          </text>
          {section.areaSqM ? (
            <text x={section.x} y={section.y + 12} fill="#94a3b8" fontSize={8} fontWeight={600} textAnchor="middle">
              {section.areaSqM} m²
            </text>
          ) : null}
        </g>
      ))}

      <g>
        <rect
          x={padding - 8}
          y={drawH - padding - 4}
          width={scaleBar.px + 16}
          height={28}
          rx={8}
          fill="rgba(15,23,42,0.75)"
        />
        <line
          x1={padding}
          y1={drawH - padding + 8}
          x2={padding + scaleBar.px}
          y2={drawH - padding + 8}
          stroke="#e2e8f0"
          strokeWidth={2}
        />
        <line x1={padding} y1={drawH - padding + 2} x2={padding} y2={drawH - padding + 14} stroke="#e2e8f0" strokeWidth={2} />
        <line
          x1={padding + scaleBar.px}
          y1={drawH - padding + 2}
          x2={padding + scaleBar.px}
          y2={drawH - padding + 14}
          stroke="#e2e8f0"
          strokeWidth={2}
        />
        <text
          x={padding + scaleBar.px / 2}
          y={drawH - padding - 6}
          fill="#cbd5e1"
          fontSize={8}
          fontWeight={700}
          textAnchor="middle"
        >
          {scaleBar.meters} m
        </text>
      </g>
    </svg>
  );
}

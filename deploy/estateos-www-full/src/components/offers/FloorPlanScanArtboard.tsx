'use client';

import { useMemo } from 'react';
import type { Locale } from '@/i18n/config';
import type { FloorPlanScanMeta, RoomScanWallSegment } from '@/types/roomScan';
import {
  buildFloorPlanViewport,
  formatWallDimension,
  mapObjectsForRender,
  mapOpeningsForRender,
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
  compact?: boolean;
};

export default function FloorPlanScanArtboard({ walls, meta, width, height, locale, className, compact }: Props) {
  const padding = compact ? 8 : 36;
  const bg = compact ? '#f4f7fb' : '#0b1220';

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

  const mappedOpenings = useMemo(
    () => mapOpeningsForRender(meta.openings, meta.bounds, viewport),
    [meta.openings, meta.bounds, viewport],
  );

  const mappedObjects = useMemo(
    () => mapObjectsForRender(meta.objects, meta.bounds, viewport),
    [meta.objects, meta.bounds, viewport],
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
      <rect x={0} y={0} width={width} height={height} fill={bg} rx={compact ? 10 : 24} />

      {compact ? null : mappedSections.map((section) => {
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
            stroke={compact ? '#94a3b8' : '#0f172a'}
            strokeWidth={compact ? 5 : 12}
            strokeLinecap="square"
          />
          <line
            x1={wall.a.x}
            y1={wall.a.y}
            x2={wall.b.x}
            y2={wall.b.y}
            stroke={compact ? '#1e293b' : '#e2e8f0'}
            strokeWidth={compact ? 1.4 : 2}
            strokeLinecap="square"
          />
          {!compact && wall.showLabel ? (
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

      {mappedOpenings.map((opening) => (
        <g key={opening.id}>
          <line
            x1={opening.a.x}
            y1={opening.a.y}
            x2={opening.b.x}
            y2={opening.b.y}
            stroke="#0b1220"
            strokeWidth={10}
            strokeLinecap="butt"
          />
          <line
            x1={opening.a.x}
            y1={opening.a.y}
            x2={opening.b.x}
            y2={opening.b.y}
            stroke={opening.kind === 'window' ? '#38bdf8' : opening.kind === 'door' ? '#fbbf24' : '#34d399'}
            strokeWidth={opening.kind === 'door' ? 5 : 3.5}
            strokeLinecap="butt"
            strokeDasharray={opening.kind === 'window' ? '6 3' : opening.kind === 'opening' ? '3 3' : undefined}
          />
        </g>
      ))}

      {mappedObjects.map((obj) => (
        <g key={obj.id} transform={`rotate(${obj.rotationDeg} ${obj.x} ${obj.y})`}>
          <rect
            x={obj.x - obj.widthPx / 2}
            y={obj.y - obj.depthPx / 2}
            width={obj.widthPx}
            height={obj.depthPx}
            rx={3}
            fill={obj.fill}
            stroke={obj.stroke}
            strokeWidth={1.3}
          />
          {compact ? null : (
          <text x={obj.x} y={obj.y + 3} fill="#f8fafc" fontSize={obj.glyph.length > 5 ? 5.5 : 6.5} fontWeight={800} textAnchor="middle">
            {obj.glyph}
          </text>
          )}
        </g>
      ))}

      {compact
        ? mappedSections.map((section) => (
            <circle
              key={`${section.id}-dot`}
              cx={section.x}
              cy={section.y}
              r={4}
              fill={section.fill}
              stroke="rgba(14,165,233,0.45)"
            />
          ))
        : mappedSections.map((section) => {
        const labelH = section.areaSqM ? 32 : 22;
        const labelW = Math.min(120, Math.max(70, section.label.length * 6.4 + 18));
        return (
          <g key={`${section.id}-label`}>
            <rect
              x={section.x - labelW / 2}
              y={section.y - labelH / 2}
              width={labelW}
              height={labelH}
              rx={8}
              fill="rgba(15,23,42,0.72)"
              stroke="rgba(56,189,248,0.28)"
              strokeWidth={0.8}
            />
            <text x={section.x} y={section.areaSqM ? section.y - 2 : section.y + 3} fill="#f8fafc" fontSize={9} fontWeight={800} textAnchor="middle">
              {section.label}
            </text>
            {section.areaSqM ? (
              <text x={section.x} y={section.y + 11} fill="#7dd3fc" fontSize={7.5} fontWeight={700} textAnchor="middle">
                {section.areaSqM} m²
              </text>
            ) : null}
          </g>
        );
      })}

      {compact ? null : (
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
      )}
    </svg>
  );
}

'use client';

import { useMemo } from 'react';
import type { Locale } from '@/i18n/config';
import type { FloorPlanScanMeta, RoomScanWallSegment } from '@/types/roomScan';
import {
  buildCleanPlanDimensions,
  buildFloorPlanViewport,
  buildWallRenderPaths,
  mapOpeningsForRender,
  mapSectionsForRender,
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
  const bg = compact ? '#f4f7fb' : '#f8fafc';

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

      {wallPaths.map((path) =>
        path.d.includes(' Z') ? (
          <path key={`${path.id}-fill`} d={path.d} fill="rgba(241,245,249,0.95)" stroke="none" />
        ) : null,
      )}

      {wallPaths.map((path) => (
        <path
          key={path.id}
          d={path.d}
          fill="none"
          stroke="#334155"
          strokeWidth={compact ? 2.2 : 3.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}

      {mappedOpenings.map((opening) => (
        <g key={opening.id}>
          <line
            x1={opening.a.x}
            y1={opening.a.y}
            x2={opening.b.x}
            y2={opening.b.y}
            stroke={bg}
            strokeWidth={compact ? 4 : 5.5}
            strokeLinecap="butt"
          />
          <line
            x1={opening.a.x}
            y1={opening.a.y}
            x2={opening.b.x}
            y2={opening.b.y}
            stroke={opening.kind === 'window' ? '#0284c7' : opening.kind === 'door' ? '#d97706' : '#059669'}
            strokeWidth={compact ? 2 : 3}
            strokeLinecap="round"
            strokeDasharray={opening.kind === 'window' ? '5 3' : undefined}
          />
        </g>
      ))}

      {compact
        ? null
        : dimensionLabels.map((label) => {
            const boxW = Math.max(36, label.text.length * 6.2 + 12);
            const fill =
              label.kind === 'window'
                ? 'rgba(224,242,254,0.96)'
                : label.kind === 'door'
                  ? 'rgba(254,243,199,0.96)'
                  : 'rgba(255,255,255,0.95)';
            const color =
              label.kind === 'window' ? '#0369a1' : label.kind === 'door' ? '#b45309' : '#0f172a';
            return (
              <g key={label.id}>
                <rect x={label.x - boxW / 2} y={label.y - 9} width={boxW} height={18} rx={9} fill={fill} />
                <text
                  x={label.x}
                  y={label.y + 4}
                  fill={color}
                  fontSize={8}
                  fontWeight={800}
                  textAnchor="middle"
                >
                  {label.text}
                </text>
              </g>
            );
          })}

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
                  fill="rgba(255,255,255,0.9)"
                  stroke="rgba(14,165,233,0.28)"
                  strokeWidth={0.8}
                />
                <text
                  x={section.x}
                  y={section.areaSqM ? section.y - 2 : section.y + 3}
                  fill="#0f172a"
                  fontSize={9}
                  fontWeight={800}
                  textAnchor="middle"
                >
                  {section.label}
                </text>
                {section.areaSqM ? (
                  <text x={section.x} y={section.y + 11} fill="#0369a1" fontSize={7.5} fontWeight={700} textAnchor="middle">
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
            fill="rgba(255,255,255,0.92)"
            stroke="#cbd5e1"
          />
          <line
            x1={padding}
            y1={drawH - padding + 8}
            x2={padding + scaleBar.px}
            y2={drawH - padding + 8}
            stroke="#1e293b"
            strokeWidth={2}
          />
          <line x1={padding} y1={drawH - padding + 2} x2={padding} y2={drawH - padding + 14} stroke="#1e293b" strokeWidth={2} />
          <line
            x1={padding + scaleBar.px}
            y1={drawH - padding + 2}
            x2={padding + scaleBar.px}
            y2={drawH - padding + 14}
            stroke="#1e293b"
            strokeWidth={2}
          />
          <text
            x={padding + scaleBar.px / 2}
            y={drawH - padding - 6}
            fill="#0f172a"
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

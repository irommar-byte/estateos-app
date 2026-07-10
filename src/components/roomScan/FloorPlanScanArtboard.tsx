import React, { useMemo, forwardRef } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText, Circle } from 'react-native-svg';
import type { FloorPlanScanMeta, RoomScanWallSegment } from '../../types/roomScan';
import {
  buildFloorPlanViewport,
  formatWallDimension,
  mapSectionsForRender,
  mapWallsForRender,
  sectionMarkerRadiusPx,
} from '../../lib/roomScan/floorPlanGeometry';
import { formatRoomScanRoomCount } from '../../lib/roomScan/roomScanLabels';
import { t } from '../../i18n';

type Props = {
  walls: RoomScanWallSegment[];
  meta: FloorPlanScanMeta;
  width: number;
  height: number;
  forExport?: boolean;
  title?: string;
};

export default forwardRef<Svg, Props>(function FloorPlanScanArtboard(
  {
    walls,
    meta,
    width,
    height,
    forExport,
    title,
  },
  ref,
) {
  const padding = forExport ? 72 : 36;
  const headerH = forExport ? 88 : 0;
  const footerH = forExport ? 56 : 0;
  const drawH = height - headerH - footerH;
  const bg = forExport ? '#0b1220' : '#0b1220';

  const viewport = useMemo(
    () => buildFloorPlanViewport(meta.bounds, width, drawH, padding),
    [meta.bounds, width, drawH, padding],
  );

  const mappedWalls = useMemo(
    () => mapWallsForRender(walls, meta.bounds, viewport, forExport),
    [walls, meta.bounds, viewport, forExport],
  );

  const mappedSections = useMemo(
    () => mapSectionsForRender(meta.sections, meta.bounds, viewport),
    [meta.sections, meta.bounds, viewport],
  );

  const scaleBar = useMemo(() => {
    const targetPx = forExport ? 120 : 72;
    const niceMeters = [1, 2, 3, 5, 10].find((m) => m * viewport.scale >= targetPx * 0.75) || 1;
    return { meters: niceMeters, px: niceMeters * viewport.scale };
  }, [viewport.scale, forExport]);

  return (
    <View style={[styles.wrap, { width, height, backgroundColor: bg }]}>
      <Svg ref={ref} width={width} height={height}>
        <Rect x={0} y={0} width={width} height={height} fill={bg} rx={forExport ? 24 : 0} />

        {forExport ? (
          <G>
            <SvgText x={padding} y={34} fill="#7dd3fc" fontSize={11} fontWeight="700" letterSpacing={2}>
              {t('addOffer.step5.roomScan.export.brand')}
            </SvgText>
            <SvgText x={padding} y={58} fill="#f8fafc" fontSize={22} fontWeight="800">
              {title || t('addOffer.step5.roomScan.export.defaultTitle')}
            </SvgText>
            <SvgText x={padding} y={78} fill="#94a3b8" fontSize={12} fontWeight="500">
              {formatRoomScanRoomCount(meta.roomCount)}
              {meta.totalAreaSqM ? ` · ~${meta.totalAreaSqM} m²` : ''}
            </SvgText>
          </G>
        ) : null}

        <G transform={`translate(0, ${headerH})`}>
          {mappedSections.map((section) => {
            const r = sectionMarkerRadiusPx(viewport, section.areaSqM);
            return (
              <G key={section.id}>
                <Circle cx={section.x} cy={section.y} r={r} fill={section.fill} />
                <Circle
                  cx={section.x}
                  cy={section.y}
                  r={r}
                  fill="none"
                  stroke="rgba(56,189,248,0.22)"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
              </G>
            );
          })}

          {mappedWalls.map((wall) => (
            <G key={wall.id}>
              <Line
                x1={wall.a.x}
                y1={wall.a.y}
                x2={wall.b.x}
                y2={wall.b.y}
                stroke="#0f172a"
                strokeWidth={forExport ? 18 : 12}
                strokeLinecap="square"
              />
              <Line
                x1={wall.a.x}
                y1={wall.a.y}
                x2={wall.b.x}
                y2={wall.b.y}
                stroke="#e2e8f0"
                strokeWidth={forExport ? 3 : 2}
                strokeLinecap="square"
              />
              {wall.showLabel ? (
                <G>
                  <Rect
                    x={wall.lx - 28}
                    y={wall.ly - 11}
                    width={56}
                    height={20}
                    rx={10}
                    fill="rgba(15,23,42,0.94)"
                    stroke="rgba(148,163,184,0.35)"
                    strokeWidth={0.5}
                  />
                  <SvgText
                    x={wall.lx}
                    y={wall.ly + 4}
                    fill="#f1f5f9"
                    fontSize={forExport ? 10 : 8}
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    {formatWallDimension(wall.len)}
                  </SvgText>
                </G>
              ) : null}
            </G>
          ))}

          {mappedSections.map((section) => (
            <G key={`${section.id}-label`}>
              <Rect
                x={section.x - 54}
                y={section.y - 22}
                width={108}
                height={section.areaSqM ? 40 : 24}
                rx={12}
                fill="rgba(15,23,42,0.88)"
                stroke="rgba(56,189,248,0.35)"
                strokeWidth={1}
              />
              <SvgText
                x={section.x}
                y={section.y - 4}
                fill="#f8fafc"
                fontSize={forExport ? 12 : 10}
                fontWeight="800"
                textAnchor="middle"
              >
                {section.label}
              </SvgText>
              {section.areaSqM ? (
                <SvgText
                  x={section.x}
                  y={section.y + 12}
                  fill="#94a3b8"
                  fontSize={forExport ? 9 : 8}
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {section.areaSqM} m²
                </SvgText>
              ) : null}
            </G>
          ))}

          <G>
            <Rect
              x={padding - 8}
              y={drawH - padding - 4}
              width={scaleBar.px + 16}
              height={28}
              rx={8}
              fill="rgba(15,23,42,0.75)"
            />
            <Line
              x1={padding}
              y1={drawH - padding + 8}
              x2={padding + scaleBar.px}
              y2={drawH - padding + 8}
              stroke="#e2e8f0"
              strokeWidth={2}
            />
            <Line x1={padding} y1={drawH - padding + 2} x2={padding} y2={drawH - padding + 14} stroke="#e2e8f0" strokeWidth={2} />
            <Line
              x1={padding + scaleBar.px}
              y1={drawH - padding + 2}
              x2={padding + scaleBar.px}
              y2={drawH - padding + 14}
              stroke="#e2e8f0"
              strokeWidth={2}
            />
            <SvgText
              x={padding + scaleBar.px / 2}
              y={drawH - padding - 6}
              fill="#cbd5e1"
              fontSize={forExport ? 10 : 8}
              fontWeight="700"
              textAnchor="middle"
            >
              {scaleBar.meters} m
            </SvgText>
          </G>
        </G>

        {forExport ? (
          <SvgText
            x={width / 2}
            y={height - 18}
            fill="#64748b"
            fontSize={10}
            fontWeight="600"
            textAnchor="middle"
          >
            {t('addOffer.step5.roomScan.export.footer')}
          </SvgText>
        ) : null}
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    borderRadius: 20,
  },
});

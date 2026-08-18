import React, { useMemo, forwardRef } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText, Circle, Polygon } from 'react-native-svg';
import type { FloorPlanScanMeta, RoomScanWallSegment } from '../../types/roomScan';
import {
  buildFloorPlanViewport,
  formatWallDimension,
  mapObjectsForRender,
  mapOpeningsForRender,
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
  const padding = forExport ? 72 : 40;
  const headerH = forExport ? 88 : 0;
  const footerH = forExport ? 56 : 0;
  const drawH = height - headerH - footerH;
  const bg = forExport ? '#f8fafc' : '#f4f7fb';
  const wallStroke = '#1e293b';
  const wallCore = '#334155';
  const dimBg = 'rgba(255,255,255,0.95)';
  const dimText = '#0f172a';
  const muted = '#64748b';

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

  const mappedObjects = useMemo(
    () => mapObjectsForRender(meta.objects || [], meta.bounds, viewport),
    [meta.objects, meta.bounds, viewport],
  );

  const mappedOpenings = useMemo(
    () => mapOpeningsForRender(meta.openings || [], meta.bounds, viewport),
    [meta.openings, meta.bounds, viewport],
  );

  const scaleBar = useMemo(() => {
    const targetPx = forExport ? 120 : 72;
    const niceMeters = [1, 2, 3, 5, 10].find((m) => m * viewport.scale >= targetPx * 0.75) || 1;
    return { meters: niceMeters, px: niceMeters * viewport.scale };
  }, [viewport.scale, forExport]);

  const compassCx = width - padding - 28;
  const compassCy = (forExport ? headerH : 0) + padding + 28;
  const compassR = forExport ? 34 : 30;

  return (
    <View style={[styles.wrap, { width, height, backgroundColor: bg }]}>
      <Svg ref={ref} width={width} height={height}>
        <Rect x={0} y={0} width={width} height={height} fill={bg} rx={forExport ? 24 : 0} />

        {/* Soft floor grid */}
        <G opacity={0.35}>
          {Array.from({ length: 12 }).map((_, i) => {
            const x = padding + i * ((width - padding * 2) / 11);
            return (
              <Line
                key={`gx-${i}`}
                x1={x}
                y1={headerH + padding * 0.4}
                x2={x}
                y2={headerH + drawH - padding * 0.4}
                stroke="#cbd5e1"
                strokeWidth={1}
              />
            );
          })}
          {Array.from({ length: 12 }).map((_, i) => {
            const y = headerH + padding * 0.4 + i * ((drawH - padding * 0.8) / 11);
            return (
              <Line
                key={`gy-${i}`}
                x1={padding * 0.4}
                y1={y}
                x2={width - padding * 0.4}
                y2={y}
                stroke="#cbd5e1"
                strokeWidth={1}
              />
            );
          })}
        </G>

        {forExport ? (
          <G>
            <SvgText x={padding} y={34} fill="#0369a1" fontSize={11} fontWeight="700" letterSpacing={2}>
              {t('addOffer.step5.roomScan.export.brand')}
            </SvgText>
            <SvgText x={padding} y={58} fill="#0f172a" fontSize={22} fontWeight="800">
              {title || t('addOffer.step5.roomScan.export.defaultTitle')}
            </SvgText>
            <SvgText x={padding} y={78} fill={muted} fontSize={12} fontWeight="500">
              {formatRoomScanRoomCount(meta.roomCount)}
              {meta.totalAreaSqM ? ` · ~${meta.totalAreaSqM} m²` : ''}
              {meta.ceilingHeightM ? ` · H ${meta.ceilingHeightM.toFixed(2)} m` : ''}
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
                  stroke="rgba(14,165,233,0.28)"
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
                stroke="#e2e8f0"
                strokeWidth={forExport ? 16 : 12}
                strokeLinecap="square"
              />
              <Line
                x1={wall.a.x}
                y1={wall.a.y}
                x2={wall.b.x}
                y2={wall.b.y}
                stroke={wallCore}
                strokeWidth={forExport ? 3.5 : 2.5}
                strokeLinecap="square"
              />
              {wall.showLabel ? (
                <G>
                  <Rect
                    x={wall.lx - 30}
                    y={wall.ly - 11}
                    width={60}
                    height={20}
                    rx={10}
                    fill={dimBg}
                    stroke="#cbd5e1"
                    strokeWidth={0.8}
                  />
                  <SvgText
                    x={wall.lx}
                    y={wall.ly + 4}
                    fill={dimText}
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

          {/* Otwory są nad ścianami, żeby drzwi, okna i przejścia nie znikały pod obrysem. */}
          {mappedOpenings.map((opening) => (
            <G key={opening.id}>
              <Line
                x1={opening.a.x}
                y1={opening.a.y}
                x2={opening.b.x}
                y2={opening.b.y}
                stroke="#f8fafc"
                strokeWidth={forExport ? 13 : 10}
                strokeLinecap="butt"
              />
              <Line
                x1={opening.a.x}
                y1={opening.a.y}
                x2={opening.b.x}
                y2={opening.b.y}
                stroke={
                  opening.kind === 'window'
                    ? '#0284c7'
                    : opening.kind === 'door'
                      ? '#f59e0b'
                      : '#10b981'
                }
                strokeWidth={opening.kind === 'door' ? 5 : 3.5}
                strokeLinecap="butt"
                strokeDasharray={opening.kind === 'window' ? '6 3' : opening.kind === 'opening' ? '3 3' : undefined}
              />
            </G>
          ))}

          {mappedObjects.map((obj) => {
            const boxW = Math.max(28, Math.min(46, obj.glyph.length * 8 + 12));
            return (
              <G key={obj.id}>
                <Rect
                  x={obj.x - boxW / 2}
                  y={obj.y - 11}
                  width={boxW}
                  height={22}
                  rx={6}
                  fill="#ffffff"
                  stroke="#94a3b8"
                  strokeWidth={1}
                />
                <SvgText
                  x={obj.x}
                  y={obj.y + 4}
                  fill="#0f172a"
                  fontSize={forExport ? 9 : 7.5}
                  fontWeight="800"
                  textAnchor="middle"
                >
                  {obj.glyph}
                </SvgText>
                <SvgText
                  x={obj.x}
                  y={obj.y + 20}
                  fill={muted}
                  fontSize={forExport ? 8 : 7}
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {obj.label}
                </SvgText>
              </G>
            );
          })}

          {mappedSections.map((section) => {
            const hasDimensions = Boolean(section.widthM && section.lengthM);
            const labelH = section.ceilingHeightM ? (hasDimensions ? 68 : 54) : hasDimensions ? 54 : section.areaSqM ? 40 : 24;
            return (
              <G key={`${section.id}-label`}>
                <Rect
                  x={section.x - 58}
                  y={section.y - labelH / 2}
                  width={116}
                  height={labelH}
                  rx={12}
                  fill="rgba(255,255,255,0.94)"
                  stroke="rgba(14,165,233,0.35)"
                  strokeWidth={1}
                />
                <SvgText
                  x={section.x}
                  y={section.y - (section.ceilingHeightM ? 10 : section.areaSqM ? 4 : 0) + 4}
                  fill="#0f172a"
                  fontSize={forExport ? 12 : 10}
                  fontWeight="800"
                  textAnchor="middle"
                >
                  {section.label}
                </SvgText>
                {section.areaSqM ? (
                  <SvgText
                    x={section.x}
                    y={section.y + (section.ceilingHeightM ? 6 : 12)}
                    fill={muted}
                    fontSize={forExport ? 9 : 8}
                    fontWeight="600"
                    textAnchor="middle"
                  >
                    {section.areaSqM} m²
                  </SvgText>
                ) : null}
                {hasDimensions ? (
                  <SvgText
                    x={section.x}
                    y={section.y + (section.ceilingHeightM ? 20 : 25)}
                    fill="#334155"
                    fontSize={forExport ? 9 : 7.5}
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    {section.widthM?.toFixed(2)} × {section.lengthM?.toFixed(2)} m
                  </SvgText>
                ) : null}
                {section.ceilingHeightM ? (
                  <SvgText
                    x={section.x}
                    y={section.y + (hasDimensions ? 33 : 20)}
                    fill="#0369a1"
                    fontSize={forExport ? 9 : 8}
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    {t('addOffer.step5.roomScan.ceilingShort', {
                      height: section.ceilingHeightM.toFixed(2),
                    })}
                  </SvgText>
                ) : null}
              </G>
            );
          })}

          {/* Scale bar */}
          <G>
            <Rect
              x={padding - 8}
              y={drawH - padding - 4}
              width={scaleBar.px + 16}
              height={28}
              rx={8}
              fill="rgba(255,255,255,0.92)"
              stroke="#cbd5e1"
            />
            <Line
              x1={padding}
              y1={drawH - padding + 8}
              x2={padding + scaleBar.px}
              y2={drawH - padding + 8}
              stroke={wallStroke}
              strokeWidth={2}
            />
            <Line x1={padding} y1={drawH - padding + 2} x2={padding} y2={drawH - padding + 14} stroke={wallStroke} strokeWidth={2} />
            <Line
              x1={padding + scaleBar.px}
              y1={drawH - padding + 2}
              x2={padding + scaleBar.px}
              y2={drawH - padding + 14}
              stroke={wallStroke}
              strokeWidth={2}
            />
            <SvgText
              x={padding + scaleBar.px / 2}
              y={drawH - padding - 6}
              fill={dimText}
              fontSize={forExport ? 10 : 8}
              fontWeight="700"
              textAnchor="middle"
            >
              {scaleBar.meters} m
            </SvgText>
          </G>
        </G>

        {/* Professional compass — N at top of drawing */}
        <G>
          <Circle cx={compassCx} cy={compassCy} r={compassR} fill="#ffffff" stroke="#94a3b8" strokeWidth={1.2} />
          <Circle cx={compassCx} cy={compassCy} r={compassR - 7} fill="none" stroke="#e2e8f0" strokeWidth={1} />
          <G transform={`rotate(${meta.northRotationDegrees || 0} ${compassCx} ${compassCy})`}>
            <Polygon
              points={`${compassCx},${compassCy - compassR + 8} ${compassCx + 7},${compassCy + 2} ${compassCx},${compassCy - 2} ${compassCx - 7},${compassCy + 2}`}
              fill="#dc2626"
            />
            <Polygon
              points={`${compassCx},${compassCy + compassR - 8} ${compassCx + 6},${compassCy - 1} ${compassCx},${compassCy + 2} ${compassCx - 6},${compassCy - 1}`}
              fill="#475569"
            />
            <SvgText x={compassCx} y={compassCy - compassR + 3} fill="#0f172a" fontSize={10} fontWeight="900" textAnchor="middle">
              N
            </SvgText>
            <SvgText x={compassCx} y={compassCy + compassR + 1} fill={muted} fontSize={8} fontWeight="700" textAnchor="middle">
              S
            </SvgText>
            <SvgText x={compassCx + compassR + 1} y={compassCy + 3} fill={muted} fontSize={8} fontWeight="700" textAnchor="middle">
              E
            </SvgText>
            <SvgText x={compassCx - compassR - 1} y={compassCy + 3} fill={muted} fontSize={8} fontWeight="700" textAnchor="middle">
              W
            </SvgText>
          </G>
          <SvgText
            x={compassCx}
            y={compassCy + compassR + 14}
            fill={muted}
            fontSize={7}
            fontWeight="600"
            textAnchor="middle"
          >
            {t('addOffer.step5.roomScan.compassHint')}
          </SvgText>
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

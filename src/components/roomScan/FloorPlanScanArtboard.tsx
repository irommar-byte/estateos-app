import React, { useMemo, forwardRef } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { G, Line, Path, Rect, Text as SvgText, Circle, Polygon } from 'react-native-svg';
import type { FloorPlanScanMeta, RoomScanWallSegment } from '../../types/roomScan';
import {
  buildCleanPlanDimensions,
  buildFloorPlanViewport,
  buildWallRenderPaths,
  mapOpeningsForRender,
  mapSectionsForRender,
} from '../../lib/roomScan/floorPlanGeometry';
import { formatRoomScanRoomCount } from '../../lib/roomScan/roomScanLabels';
import { t } from '../../i18n';

type Props = {
  walls: RoomScanWallSegment[];
  meta: FloorPlanScanMeta;
  width: number;
  height: number;
  forExport?: boolean;
  compact?: boolean;
  title?: string;
  onSectionPress?: (sectionIndex: number) => void;
};

export default forwardRef<Svg, Props>(function FloorPlanScanArtboard(
  {
    walls,
    meta,
    width,
    height,
    forExport,
    compact,
    title,
    onSectionPress,
  },
  ref,
) {
  const padding = compact ? 8 : forExport ? 72 : 40;
  const headerH = compact ? 0 : forExport ? 88 : 0;
  const footerH = compact ? 0 : forExport ? 56 : 0;
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

  const wallPaths = useMemo(
    () => buildWallRenderPaths(walls, meta.bounds, viewport),
    [walls, meta.bounds, viewport],
  );

  const mappedSections = useMemo(
    () => mapSectionsForRender(meta.sections, meta.bounds, viewport),
    [meta.sections, meta.bounds, viewport],
  );

  const mappedOpenings = useMemo(
    () => mapOpeningsForRender(meta.openings || [], meta.bounds, viewport),
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
          {wallPaths.map((path) =>
            path.d.includes(' Z') ? (
              <Path key={`${path.id}-fill`} d={path.d} fill="rgba(241,245,249,0.95)" stroke="none" />
            ) : null,
          )}

          {wallPaths.map((path) => (
            <Path
              key={path.id}
              d={path.d}
              fill="none"
              stroke={wallCore}
              strokeWidth={compact ? 2.2 : forExport ? 4 : 3.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {mappedOpenings.map((opening) => (
            <G key={opening.id}>
              <Line
                x1={opening.a.x}
                y1={opening.a.y}
                x2={opening.b.x}
                y2={opening.b.y}
                stroke={bg}
                strokeWidth={compact ? 4 : forExport ? 7 : 5.5}
                strokeLinecap="butt"
              />
              <Line
                x1={opening.a.x}
                y1={opening.a.y}
                x2={opening.b.x}
                y2={opening.b.y}
                stroke={
                  opening.kind === 'window' ? '#0284c7' : opening.kind === 'door' ? '#d97706' : '#059669'
                }
                strokeWidth={compact ? 2 : 3}
                strokeLinecap="round"
                strokeDasharray={opening.kind === 'window' ? '5 3' : undefined}
              />
            </G>
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
                      : dimBg;
                const color =
                  label.kind === 'window' ? '#0369a1' : label.kind === 'door' ? '#b45309' : dimText;
                return (
                  <G key={label.id}>
                    <Rect
                      x={label.x - boxW / 2}
                      y={label.y - 9}
                      width={boxW}
                      height={18}
                      rx={9}
                      fill={fill}
                    />
                    <SvgText
                      x={label.x}
                      y={label.y + 4}
                      fill={color}
                      fontSize={forExport ? 9 : 8}
                      fontWeight="800"
                      textAnchor="middle"
                    >
                      {label.text}
                    </SvgText>
                  </G>
                );
              })}

          {compact
            ? mappedSections.map((section) => (
                <Circle
                  key={`${section.id}-dot`}
                  cx={section.x}
                  cy={section.y}
                  r={5}
                  fill={section.fill}
                  stroke="rgba(14,165,233,0.4)"
                />
              ))
            : mappedSections.map((section, index) => {
            const lines = [section.label, section.areaSqM ? `${section.areaSqM} m²` : null].filter(Boolean) as string[];
            const lineH = forExport ? 12 : 10;
            const boxH = Math.max(28, lines.length * lineH + 10);
            const boxW = Math.min(108, Math.max(64, section.label.length * 7 + 16));
            return (
              <G key={`${section.id}-label`} onPress={onSectionPress ? () => onSectionPress(index) : undefined}>
                <Circle
                  cx={section.x}
                  cy={section.y}
                  r={Math.max(22, Math.min(boxW, boxH) / 2 + 8)}
                  fill="transparent"
                  onPress={onSectionPress ? () => onSectionPress(index) : undefined}
                />
                <Rect
                  x={section.x - boxW / 2}
                  y={section.y - boxH / 2}
                  width={boxW}
                  height={boxH}
                  rx={8}
                  fill="rgba(255,255,255,0.82)"
                  stroke={onSectionPress ? 'rgba(14,165,233,0.55)' : 'rgba(14,165,233,0.28)'}
                  strokeWidth={onSectionPress ? 1.2 : 0.8}
                  onPress={onSectionPress ? () => onSectionPress(index) : undefined}
                />
                {lines.map((line, i) => (
                  <SvgText
                    key={`${section.id}-l-${i}`}
                    x={section.x}
                    y={section.y - (lines.length - 1) * (lineH / 2) + i * lineH + 3}
                    fill={i === 0 ? '#0f172a' : '#0369a1'}
                    fontSize={i === 0 ? (forExport ? 10 : 8) : forExport ? 8 : 7}
                    fontWeight={i === 0 ? '800' : '700'}
                    textAnchor="middle"
                  >
                    {line}
                  </SvgText>
                ))}
              </G>
            );
          })}

          {compact ? null : (
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
          )}
        </G>

        {compact ? null : (
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
          </G>
          <SvgText x={compassCx} y={compassCy - compassR + 12} fill="#0f172a" fontSize={10} fontWeight="900" textAnchor="middle">
            N
          </SvgText>
          <SvgText x={compassCx} y={compassCy + compassR - 4} fill={muted} fontSize={8} fontWeight="700" textAnchor="middle">
            S
          </SvgText>
          <SvgText x={compassCx + compassR - 7} y={compassCy + 3} fill={muted} fontSize={8} fontWeight="700" textAnchor="middle">
            E
          </SvgText>
          <SvgText x={compassCx - compassR + 7} y={compassCy + 3} fill={muted} fontSize={8} fontWeight="700" textAnchor="middle">
            W
          </SvgText>
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
        )}

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

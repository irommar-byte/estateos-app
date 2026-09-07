import React, { useMemo, forwardRef } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import Svg, { G, Line, Path, Rect, Text as SvgText, Circle, Polygon } from 'react-native-svg';
import type { FloorPlanScanMeta, RoomScanWallSegment } from '../../types/roomScan';
import type { DimensionSegment } from '../../lib/roomScan/floorPlanGeometry';
import {
  buildFloorPlanViewport,
  buildWallRenderPaths,
  mapFloorPlanPoint,
  mapObjectsForRender,
  mapOpeningsForRender,
  mapSectionsForRender,
} from '../../lib/roomScan/floorPlanGeometry';
import {
  architecturalAvoidPoints,
  buildArchitecturalWallBands,
  dimensionSegmentsForRender,
  layoutArchitecturalCenterLabel,
  layoutArchitecturalSectionLabels,
  orthogonalizeScanPlan,
  prepareArchitecturalDimensionChains,
} from '../../lib/roomScan/floorPlanArchitectural';
import { ArchitecturalFurnitureSymbol } from '../../lib/roomScan/floorPlanFurnitureSymbols';
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
  hideDimensions?: boolean;
};

const SCRIPT_FONT = Platform.select({
  ios: 'Snell Roundhand',
  android: 'cursive',
  default: 'Georgia',
});

function DimensionTick({ x, y, angleDeg }: { x: number; y: number; angleDeg: number }) {
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(rad + Math.PI / 4) * 5.5;
  const dy = Math.sin(rad + Math.PI / 4) * 5.5;
  return (
    <Line x1={x - dx} y1={y - dy} x2={x + dx} y2={y + dy} stroke="#111827" strokeWidth={1.1} />
  );
}

function ArchitecturalDimension({
  segment,
  wallHalfPx,
  fontSize,
}: {
  segment: DimensionSegment;
  wallHalfPx: number;
  fontSize: number;
}) {
  const angle = (Math.atan2(segment.b.y - segment.a.y, segment.b.x - segment.a.x) * 180) / Math.PI;
  const wallA = segment.wallA || segment.a;
  const wallB = segment.wallB || segment.b;
  const extensionStart = (
    wall: { x: number; y: number },
    dimension: { x: number; y: number },
  ) => {
    const dx = dimension.x - wall.x;
    const dy = dimension.y - wall.y;
    const length = Math.hypot(dx, dy) || 1;
    return {
      x: wall.x + (dx / length) * wallHalfPx,
      y: wall.y + (dy / length) * wallHalfPx,
    };
  };
  const extensionA = extensionStart(wallA, segment.a);
  const extensionB = extensionStart(wallB, segment.b);
  const labelRotation = ((((angle + 90) % 180) + 180) % 180) - 90;
  const labelY = segment.ly + fontSize * 0.34;
  return (
    <G>
      <Line
        x1={extensionA.x}
        y1={extensionA.y}
        x2={segment.a.x}
        y2={segment.a.y}
        stroke="#111827"
        strokeWidth={0.65}
      />
      <Line
        x1={extensionB.x}
        y1={extensionB.y}
        x2={segment.b.x}
        y2={segment.b.y}
        stroke="#111827"
        strokeWidth={0.65}
      />
      <Line x1={segment.a.x} y1={segment.a.y} x2={segment.b.x} y2={segment.b.y} stroke="#111827" strokeWidth={0.85} />
      <DimensionTick x={segment.a.x} y={segment.a.y} angleDeg={angle} />
      <DimensionTick x={segment.b.x} y={segment.b.y} angleDeg={angle} />
      <SvgText
        x={segment.lx}
        y={labelY}
        fill="#111827"
        fontSize={fontSize}
        fontWeight="500"
        textAnchor="middle"
        transform={Math.abs(labelRotation) > 0.5 ? `rotate(${labelRotation} ${segment.lx} ${labelY})` : undefined}
      >
        {segment.label}
      </SvgText>
    </G>
  );
}

function WindowOpening({
  a,
  b,
  wallHalf,
}: {
  a: { x: number; y: number };
  b: { x: number; y: number };
  wallHalf: number;
}) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * wallHalf;
  const ny = (dx / len) * wallHalf;
  return (
    <G>
      <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#ffffff" strokeWidth={wallHalf * 2 + 2} strokeLinecap="butt" />
      <Line
        x1={a.x + nx * 0.82}
        y1={a.y + ny * 0.82}
        x2={b.x + nx * 0.82}
        y2={b.y + ny * 0.82}
        stroke="#111827"
        strokeWidth={0.9}
        strokeDasharray="5 3"
      />
      <Line
        x1={a.x - nx * 0.82}
        y1={a.y - ny * 0.82}
        x2={b.x - nx * 0.82}
        y2={b.y - ny * 0.82}
        stroke="#111827"
        strokeWidth={0.9}
        strokeDasharray="5 3"
      />
      <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#2563eb" strokeWidth={3.2} />
      <Line x1={a.x + nx} y1={a.y + ny} x2={a.x - nx} y2={a.y - ny} stroke="#111827" strokeWidth={1.1} />
      <Line x1={b.x + nx} y1={b.y + ny} x2={b.x - nx} y2={b.y - ny} stroke="#111827" strokeWidth={1.1} />
    </G>
  );
}

function PlainOpening({
  a,
  b,
  wallHalf,
}: {
  a: { x: number; y: number };
  b: { x: number; y: number };
  wallHalf: number;
}) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = (-dy / length) * wallHalf;
  const ny = (dx / length) * wallHalf;
  return (
    <G>
      <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#ffffff" strokeWidth={wallHalf * 2 + 2} strokeLinecap="butt" />
      <Line x1={a.x + nx} y1={a.y + ny} x2={a.x - nx} y2={a.y - ny} stroke="#111827" strokeWidth={1.1} />
      <Line x1={b.x + nx} y1={b.y + ny} x2={b.x - nx} y2={b.y - ny} stroke="#111827" strokeWidth={1.1} />
    </G>
  );
}

function DoorOpening({
  a,
  b,
  wallHalf,
  roomCenter,
}: {
  a: { x: number; y: number };
  b: { x: number; y: number };
  wallHalf: number;
  roomCenter: { x: number; y: number };
}) {
  // RoomPlan nie podaje zawiasu. W typowym rzucie skrzydło jest mocowane
  // przy końcu otworu bliższym narożnikowi, czyli dalej od środka pokoju.
  const distanceA = Math.hypot(a.x - roomCenter.x, a.y - roomCenter.y);
  const distanceB = Math.hypot(b.x - roomCenter.x, b.y - roomCenter.y);
  const hinge = distanceA >= distanceB ? a : b;
  const closedEnd = hinge === a ? b : a;
  const dx = closedEnd.x - hinge.x;
  const dy = closedEnd.y - hinge.y;
  const radius = Math.hypot(dx, dy) || 1;
  const nx = -dy / radius;
  const ny = dx / radius;
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;
  const towardCenter = (roomCenter.x - midX) * nx + (roomCenter.y - midY) * ny;
  const inward = towardCenter >= 0 ? 1 : -1;
  const hingeInner = {
    x: hinge.x + nx * wallHalf * inward,
    y: hinge.y + ny * wallHalf * inward,
  };
  const closedEndInner = {
    x: closedEnd.x + nx * wallHalf * inward,
    y: closedEnd.y + ny * wallHalf * inward,
  };
  const openEnd = {
    x: hingeInner.x + nx * radius * inward,
    y: hingeInner.y + ny * radius * inward,
  };
  const openVector = { x: openEnd.x - hingeInner.x, y: openEnd.y - hingeInner.y };
  const sweep = dx * openVector.y - dy * openVector.x >= 0 ? 1 : 0;
  const swingPath =
    `M ${closedEndInner.x.toFixed(1)} ${closedEndInner.y.toFixed(1)} ` +
    `A ${radius.toFixed(1)} ${radius.toFixed(1)} 0 0 ${sweep} ${openEnd.x.toFixed(1)} ${openEnd.y.toFixed(1)}`;
  return (
    <G>
      <PlainOpening a={a} b={b} wallHalf={wallHalf} />
      <Line
        x1={hingeInner.x}
        y1={hingeInner.y}
        x2={openEnd.x}
        y2={openEnd.y}
        stroke="#111827"
        strokeWidth={1.15}
      />
      <Path
        d={swingPath}
        fill="none"
        stroke="#111827"
        strokeWidth={1}
      />
    </G>
  );
}

function CompassRose({ cx, cy, r, rotationDeg }: { cx: number; cy: number; r: number; rotationDeg: number }) {
  const rot = Number.isFinite(rotationDeg) ? rotationDeg : 0;
  const labelRadius = r + Math.max(7, r * 0.36);
  const labelFontSize = Math.max(7, Math.min(12, r * 0.42));
  const cardinalLabels = [
    { label: 'N', angle: -90 },
    { label: 'E', angle: 0 },
    { label: 'S', angle: 90 },
    { label: 'W', angle: 180 },
  ].map((item) => {
    const angle = ((item.angle + rot) * Math.PI) / 180;
    return {
      ...item,
      x: cx + Math.cos(angle) * labelRadius,
      y: cy + Math.sin(angle) * labelRadius + 3,
    };
  });
  return (
    <G>
      <G transform={`translate(${cx} ${cy}) rotate(${rot})`}>
        <Polygon
          points={`0,${-r} 4,-4 ${r},0 4,4 0,${r} -4,4 ${-r},0 -4,-4`}
          fill="#ffffff"
          stroke="#111827"
          strokeWidth={1.15}
          strokeLinejoin="miter"
        />
        <Polygon points={`0,${-r} 0,0 4,-4`} fill="#111827" />
        <Polygon points={`${r},0 0,0 4,4`} fill="#111827" />
        <Polygon points={`0,${r} 0,0 -4,4`} fill="#111827" />
        <Polygon points={`${-r},0 0,0 -4,-4`} fill="#111827" />
      </G>
      {cardinalLabels.map((item) => (
        <SvgText
          key={item.label}
          x={item.x}
          y={item.y + labelFontSize * 0.08}
          fill="#111827"
          fontSize={labelFontSize}
          fontWeight="500"
          textAnchor="middle"
        >
          {item.label}
        </SvgText>
      ))}
    </G>
  );
}

export default forwardRef<Svg, Props>(function FloorPlanScanArtboard(
  { walls, meta, width, height, forExport, compact, title, onSectionPress, hideDimensions = false },
  ref,
) {
  const architectural = !compact;
  const headerH = compact || architectural ? 0 : forExport ? 88 : 0;
  const footerH = compact || architectural ? 0 : forExport ? 56 : 0;
  const drawH = height - headerH - footerH;
  const artboardMinSide = Math.min(width, drawH);
  const denseArchitectural = architectural && artboardMinSide < 240;
  const architecturalPadding = Math.max(
    40,
    Math.min(forExport ? 180 : 126, artboardMinSide * 0.25),
  );
  const padding = compact ? 8 : architectural ? architecturalPadding : forExport ? 88 : 72;
  const bg = architectural ? '#ffffff' : forExport ? '#f8fafc' : '#f4f7fb';
  const muted = '#64748b';

  const plan = useMemo(
    () => (architectural ? orthogonalizeScanPlan(walls, meta) : { walls, meta }),
    [architectural, walls, meta],
  );

  const viewport = useMemo(
    () => buildFloorPlanViewport(plan.meta.bounds, width, drawH, padding),
    [plan.meta.bounds, width, drawH, padding],
  );

  const wallPaths = useMemo(
    () => buildWallRenderPaths(plan.walls, plan.meta.bounds, viewport),
    [plan.walls, plan.meta.bounds, viewport],
  );

  const wallBands = useMemo(
    () => (architectural ? buildArchitecturalWallBands(plan.walls, plan.meta.bounds, viewport) : []),
    [architectural, plan.walls, plan.meta.bounds, viewport],
  );

  const wallHalfPx = useMemo(
    () => Math.max(4, Math.min(11, viewport.scale * 0.095)),
    [viewport.scale],
  );

  const mappedSections = useMemo(
    () => mapSectionsForRender(plan.meta.sections, plan.meta.bounds, viewport),
    [plan.meta.sections, plan.meta.bounds, viewport],
  );

  const mappedOpenings = useMemo(
    () => mapOpeningsForRender(plan.meta.openings || [], plan.meta.bounds, viewport),
    [plan.meta.openings, plan.meta.bounds, viewport],
  );

  const mappedObjects = useMemo(
    () => mapObjectsForRender(plan.meta.objects || [], plan.meta.bounds, viewport, { architectural }),
    [plan.meta.objects, plan.meta.bounds, viewport, architectural],
  );

  const dimensionChains = useMemo(
    () =>
      architectural && !hideDimensions
        ? prepareArchitecturalDimensionChains(plan.walls, plan.meta.openings || [], plan.meta.bounds, viewport)
        : [],
    [architectural, hideDimensions, plan.walls, plan.meta.openings, plan.meta.bounds, viewport],
  );

  const dimensionLabelPoints = useMemo(
    () =>
      dimensionChains.flatMap((chain) =>
        dimensionSegmentsForRender(chain).map((segment) => ({ x: segment.lx, y: segment.ly })),
      ),
    [dimensionChains],
  );

  const roomCenter = useMemo(() => {
    const cx = (plan.meta.bounds.minX + plan.meta.bounds.maxX) / 2;
    const cz = (plan.meta.bounds.minZ + plan.meta.bounds.maxZ) / 2;
    return mapFloorPlanPoint(cx, cz, plan.meta.bounds, viewport);
  }, [plan.meta.bounds, viewport]);

  const planLeft = viewport.offsetX;
  const planRight = viewport.offsetX + (plan.meta.bounds.maxX - plan.meta.bounds.minX) * viewport.scale;
  const planTop = viewport.offsetY;
  const planBottom = viewport.offsetY + (plan.meta.bounds.maxZ - plan.meta.bounds.minZ) * viewport.scale;
  const dimensionFontSize = Math.max(denseArchitectural ? 7.5 : 9, Math.min(15, viewport.scale * 0.145));
  const roomNameFontSize = Math.max(denseArchitectural ? 10 : 16, Math.min(29, viewport.scale * 0.26));
  const roomNameLineHeight = roomNameFontSize * 1.02;
  const areaFontSize = Math.max(denseArchitectural ? 8 : 11, Math.min(17, viewport.scale * 0.16));
  const areaLineHeight = areaFontSize * 1.15;

  const sectionLabels = useMemo(() => {
    if (!architectural) return [];
    const avoid = architecturalAvoidPoints(mappedObjects, dimensionLabelPoints);
    if (mappedSections.length > 1) {
      return layoutArchitecturalSectionLabels(mappedSections, avoid, {
        nameFontSize: roomNameFontSize,
        nameLineHeight: roomNameLineHeight,
        nameAreaGap: Math.max(4, roomNameFontSize * 0.16),
        areaFontSize,
        areaLineHeight,
      });
    }
    return layoutArchitecturalCenterLabel(mappedSections, plan.meta, roomCenter, avoid, {
      roomRect: {
        left: planLeft + wallHalfPx,
        right: planRight - wallHalfPx,
        top: planTop + wallHalfPx,
        bottom: planBottom - wallHalfPx,
      },
      nameFontSize: roomNameFontSize,
      nameLineHeight: roomNameLineHeight,
      nameAreaGap: Math.max(4, roomNameFontSize * 0.16),
      areaFontSize,
      areaLineHeight,
    });
  }, [
    architectural,
    mappedObjects,
    dimensionLabelPoints,
    mappedSections,
    plan.meta,
    roomCenter,
    planLeft,
    planRight,
    planTop,
    planBottom,
    wallHalfPx,
    roomNameFontSize,
    roomNameLineHeight,
    areaFontSize,
    areaLineHeight,
  ]);

  const compassR = denseArchitectural ? 12 : forExport ? 28 : 23;
  const compassGapX = denseArchitectural ? 24 : forExport ? 65 : 45;
  const compassGapY = denseArchitectural ? 30 : forExport ? 78 : 55;
  const compassCx = Math.max(compassR + 12, Math.min(width - compassR - 12, planRight + compassGapX));
  const compassCy = Math.max(compassR + 14, Math.min(height - compassR - 14, planTop - compassGapY));

  return (
    <View style={[styles.wrap, { width, height, backgroundColor: bg, borderRadius: architectural ? 0 : 20 }]}>
      <Svg ref={ref} width={width} height={height}>
        <Rect x={0} y={0} width={width} height={height} fill={bg} rx={architectural ? 0 : forExport ? 24 : 0} />

        {!architectural && forExport ? (
          <G>
            <SvgText x={padding} y={34} fill="#0369a1" fontSize={11} fontWeight="700" letterSpacing={2}>
              {t('addOffer.step5.roomScan.export.brand')}
            </SvgText>
            <SvgText x={padding} y={58} fill="#0f172a" fontSize={22} fontWeight="800">
              {title || t('addOffer.step5.roomScan.export.defaultTitle')}
            </SvgText>
            <SvgText x={padding} y={78} fill={muted} fontSize={12} fontWeight="500">
              {formatRoomScanRoomCount(plan.meta.roomCount)}
              {plan.meta.totalAreaSqM ? ` · ~${plan.meta.totalAreaSqM} m²` : ''}
              {plan.meta.ceilingHeightM ? ` · H ${plan.meta.ceilingHeightM.toFixed(2)} m` : ''}
            </SvgText>
          </G>
        ) : null}

        <G transform={`translate(0, ${headerH})`}>
          {wallPaths.map((path) =>
            path.d.includes(' Z') ? (
              <Path
                key={`${path.id}-floor`}
                d={path.d}
                fill={architectural ? '#ffffff' : 'rgba(241,245,249,0.95)'}
                stroke="none"
              />
            ) : null,
          )}

          {architectural
            ? (
                <G>
                  {wallBands.map((band) => (
                    <Path key={`${band.id}-fill`} d={band.d} fill="#a6a6a6" stroke="none" />
                  ))}
                  {wallBands.map((band) => (
                    <Line
                      key={`${band.id}-inner`}
                      x1={band.inner.a.x}
                      y1={band.inner.a.y}
                      x2={band.inner.b.x}
                      y2={band.inner.b.y}
                      stroke="#111827"
                      strokeWidth={1.4}
                      strokeLinecap="square"
                    />
                  ))}
                  {wallBands.map((band) => (
                    <Line
                      key={`${band.id}-outer`}
                      x1={band.outer.a.x}
                      y1={band.outer.a.y}
                      x2={band.outer.b.x}
                      y2={band.outer.b.y}
                      stroke="#111827"
                      strokeWidth={1.25}
                      strokeDasharray="7 3"
                      strokeLinecap="square"
                    />
                  ))}
                </G>
              )
            : null}

          {!architectural
            ? wallPaths.map((path) => (
                <Path
                  key={path.id}
                  d={path.d}
                  fill="none"
                  stroke="#334155"
                  strokeWidth={compact ? 2.2 : forExport ? 4 : 3.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))
            : null}

          {mappedOpenings.map((opening) => (
            <G key={opening.id}>
              {architectural ? (
                opening.kind === 'window' ? (
                  <WindowOpening a={opening.a} b={opening.b} wallHalf={wallHalfPx} />
                ) : opening.kind === 'door' ? (
                  <DoorOpening
                    a={opening.a}
                    b={opening.b}
                    wallHalf={wallHalfPx}
                    roomCenter={roomCenter}
                  />
                ) : (
                  <PlainOpening a={opening.a} b={opening.b} wallHalf={wallHalfPx} />
                )
              ) : (
                <>
                  <Line
                    x1={opening.a.x}
                    y1={opening.a.y}
                    x2={opening.b.x}
                    y2={opening.b.y}
                    stroke={bg}
                    strokeWidth={compact ? 4 : 5.5}
                    strokeLinecap="butt"
                  />
                  {opening.kind === 'window' ? (
                    <Line x1={opening.a.x} y1={opening.a.y} x2={opening.b.x} y2={opening.b.y} stroke="#2563eb" strokeWidth={2.4} />
                  ) : opening.kind === 'door' ? (
                    <Line x1={opening.a.x} y1={opening.a.y} x2={opening.b.x} y2={opening.b.y} stroke="#d97706" strokeWidth={2} />
                  ) : (
                    <Line x1={opening.a.x} y1={opening.a.y} x2={opening.b.x} y2={opening.b.y} stroke="#059669" strokeWidth={2} />
                  )}
                </>
              )}
            </G>
          ))}

          {architectural ? mappedObjects.map((obj) => <ArchitecturalFurnitureSymbol key={obj.id} obj={obj} />) : null}

          {architectural
            ? dimensionChains.flatMap((chain) =>
                dimensionSegmentsForRender(chain).map((segment) => (
                  <ArchitecturalDimension
                    key={segment.id}
                    segment={segment}
                    wallHalfPx={wallHalfPx}
                    fontSize={dimensionFontSize}
                  />
                )),
              )
            : null}

          {!architectural && !compact
            ? mappedSections.map((section, index) => {
                const lines = [section.label, !hideDimensions && section.areaSqM ? `${section.areaSqM} m²` : null].filter(Boolean) as string[];
                const lineH = forExport ? 12 : 10;
                const boxH = Math.max(28, lines.length * lineH + 10);
                const boxW = Math.min(108, Math.max(64, section.label.length * 7 + 16));
                return (
                  <G key={`${section.id}-label`} onPress={onSectionPress ? () => onSectionPress(index) : undefined}>
                    <Rect
                      x={section.x - boxW / 2}
                      y={section.y - boxH / 2}
                      width={boxW}
                      height={boxH}
                      rx={8}
                      fill="rgba(255,255,255,0.82)"
                      stroke="rgba(14,165,233,0.28)"
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
              })
            : null}

          {architectural
            ? sectionLabels.map((label) => (
                <G
                  key={label.id}
                  onPress={
                    onSectionPress
                      ? () => {
                          const index = label.id === 'center-label'
                            ? 0
                            : mappedSections.findIndex((section) => section.id === label.id);
                          if (index >= 0) onSectionPress(index);
                        }
                      : undefined
                  }
                >
                  {label.nameLines.map((line, index) => (
                    <SvgText
                      key={`${label.id}-name-${index}`}
                      x={label.x}
                      y={label.nameStartY + index * roomNameLineHeight}
                      fill="#dc2626"
                      fontSize={roomNameFontSize}
                      fontFamily={SCRIPT_FONT}
                      textAnchor="middle"
                    >
                      {line}
                    </SvgText>
                  ))}
                  {label.areaText && !hideDimensions ? (
                    <SvgText
                      x={label.x}
                      y={label.nameLines.length ? label.areaY : label.areaY}
                      fill="#111827"
                      fontSize={areaFontSize}
                      fontWeight="400"
                      textAnchor="middle"
                    >
                      {label.areaText}
                    </SvgText>
                  ) : null}
                </G>
              ))
            : null}

          {compact
            ? mappedSections.map((section) => (
                <Circle key={`${section.id}-dot`} cx={section.x} cy={section.y} r={5} fill={section.fill} stroke="rgba(14,165,233,0.4)" />
              ))
            : null}
        </G>

        {compact ? null : (
          <CompassRose
            cx={compassCx}
            cy={compassCy + headerH}
            r={compassR}
            rotationDeg={plan.meta.northRotationDegrees ?? 0}
          />
        )}

        {!architectural && forExport ? (
          <SvgText x={width / 2} y={height - 18} fill="#64748b" fontSize={10} fontWeight="600" textAnchor="middle">
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

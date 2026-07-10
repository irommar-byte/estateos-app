import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { FloorPlanScanMeta, RoomScanWallSegment } from '../../types/roomScan';
import { t } from '../../i18n';
import {
  buildFloorPlanViewport,
  formatWallDimension,
  mapSectionsForRender,
  mapWallsForRender,
  sectionMarkerRadiusPx,
} from './floorPlanGeometry';
import { formatRoomScanRoomCount } from './roomScanLabels';

export async function exportFloorPlanPdfFromMeta(
  walls: RoomScanWallSegment[],
  meta: FloorPlanScanMeta,
  title: string,
): Promise<string | null> {
  const width = 1080;
  const height = 1480;
  const padding = 72;
  const headerH = 88;
  const drawH = height - headerH - 56;
  const viewport = buildFloorPlanViewport(meta.bounds, width, drawH, padding);
  const mappedWalls = mapWallsForRender(walls, meta.bounds, viewport, true);
  const mappedSections = mapSectionsForRender(meta.sections, meta.bounds, viewport);

  const roomCountLabel = formatRoomScanRoomCount(meta.roomCount);
  const exportTitle = title || t('addOffer.step5.roomScan.export.defaultTitle');
  const exportBrand = t('addOffer.step5.roomScan.export.brand');
  const exportFooter = t('addOffer.step5.roomScan.export.footer');

  const wallLines = mappedWalls
    .map(
      (wall) => `
      <line x1="${wall.a.x}" y1="${wall.a.y + headerH}" x2="${wall.b.x}" y2="${wall.b.y + headerH}" stroke="#0f172a" stroke-width="18" stroke-linecap="square" />
      <line x1="${wall.a.x}" y1="${wall.a.y + headerH}" x2="${wall.b.x}" y2="${wall.b.y + headerH}" stroke="#e2e8f0" stroke-width="3" stroke-linecap="square" />
      ${
        wall.showLabel
          ? `<text x="${wall.lx}" y="${wall.ly + headerH + 4}" fill="#f1f5f9" font-size="10" font-weight="700" text-anchor="middle">${formatWallDimension(wall.len)}</text>`
          : ''
      }`,
    )
    .join('');

  const sectionNodes = mappedSections
    .map((section) => {
      const r = sectionMarkerRadiusPx(viewport, section.areaSqM);
      const y = section.y + headerH;
      return `
      <circle cx="${section.x}" cy="${y}" r="${r}" fill="${section.fill}" stroke="rgba(56,189,248,0.35)" stroke-width="1" stroke-dasharray="4 4" />
      <rect x="${section.x - 54}" y="${y - 22}" width="108" height="${section.areaSqM ? 40 : 24}" rx="12" fill="rgba(15,23,42,0.88)" stroke="rgba(56,189,248,0.35)" />
      <text x="${section.x}" y="${y - 4}" fill="#f8fafc" font-size="12" font-weight="800" text-anchor="middle">${escapeHtml(section.label)}</text>
      ${
        section.areaSqM
          ? `<text x="${section.x}" y="${y + 12}" fill="#94a3b8" font-size="9" font-weight="600" text-anchor="middle">${section.areaSqM} m²</text>`
          : ''
      }`;
    })
    .join('');

  const scaleBarM = [1, 2, 3, 5, 10].find((m) => m * viewport.scale >= 90) || 1;
  const scaleBarPx = scaleBarM * viewport.scale;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { margin: 12mm; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0b1220; }
  </style>
</head>
<body>
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#0b1220" rx="24" />
    <text x="${padding}" y="34" fill="#7dd3fc" font-size="11" font-weight="700" letter-spacing="2">${escapeHtml(exportBrand)}</text>
    <text x="${padding}" y="58" fill="#f8fafc" font-size="22" font-weight="800">${escapeHtml(exportTitle)}</text>
    <text x="${padding}" y="78" fill="#94a3b8" font-size="12">${escapeHtml(roomCountLabel)}${meta.totalAreaSqM ? ` · ~${meta.totalAreaSqM} m²` : ''}</text>
    ${sectionNodes}
    ${wallLines}
    <line x1="${padding}" y1="${height - padding - 8}" x2="${padding + scaleBarPx}" y2="${height - padding - 8}" stroke="#e2e8f0" stroke-width="2" />
    <text x="${padding + scaleBarPx / 2}" y="${height - padding - 16}" fill="#cbd5e1" font-size="10" font-weight="700" text-anchor="middle">${scaleBarM} m</text>
    <text x="${width / 2}" y="${height - 18}" fill="#64748b" font-size="10" font-weight="600" text-anchor="middle">${escapeHtml(exportFooter)}</text>
  </svg>
</body>
</html>`;

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  return uri;
}

export async function shareFloorPlanPdf(pdfUri: string): Promise<void> {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) return;
  await Sharing.shareAsync(pdfUri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: t('addOffer.step5.roomScan.export.pdfDialogTitle'),
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

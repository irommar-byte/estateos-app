/** Metraż działki — wymagany dla HOUSE i PLOT (warstwa aplikacji; kolumna w DB pozostaje nullable dla starszych rekordów). */

export function normalizePropertyType(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
}

export function parsePlotAreaValue(body: {
  propertyType?: unknown;
  plotArea?: unknown;
  area?: unknown;
}): number | null {
  const type = normalizePropertyType(body.propertyType);
  const raw =
    type === 'PLOT'
      ? body.area ?? body.plotArea
      : body.plotArea;
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const num = Number(String(raw).replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(num) && num > 0 ? num : null;
}

export function assertPlotAreaRequired(body: {
  propertyType?: unknown;
  plotArea?: unknown;
  area?: unknown;
}): void {
  const type = normalizePropertyType(body.propertyType);
  if (type !== 'HOUSE' && type !== 'PLOT') return;
  const plot = parsePlotAreaValue(body);
  if (plot === null) {
    throw new Error(
      type === 'PLOT'
        ? 'Metraż działki jest wymagany.'
        : 'Metraż działki jest wymagany dla domu jednorodzinnego.',
    );
  }
}

export function resolvePlotAreaForPersistence(body: {
  propertyType?: unknown;
  plotArea?: unknown;
  area?: unknown;
}): number | null {
  const type = normalizePropertyType(body.propertyType);
  if (type === 'PLOT') {
    return parsePlotAreaValue(body);
  }
  if (type === 'HOUSE') {
    return parsePlotAreaValue(body);
  }
  if (body.plotArea === undefined || body.plotArea === null || String(body.plotArea).trim() === '') {
    return null;
  }
  const num = Number(String(body.plotArea).replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(num) && num > 0 ? num : null;
}

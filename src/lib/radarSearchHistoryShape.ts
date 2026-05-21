import type { RadarSearchHistory } from '@prisma/client';

export const DEFAULT_RADAR_SEARCH_HISTORY_LIMIT = 50;
export const MAX_RADAR_SEARCH_HISTORY_LIMIT = 200;

export type RadarSearchHistoryDto = {
  id: number;
  eventType: string;
  transactionType: string | null;
  propertyType: string | null;
  city: string | null;
  selectedDistricts: string[];
  maxPrice: number | null;
  minArea: number | null;
  minYear: number | null;
  requireBalcony: boolean;
  requireGarden: boolean;
  requireElevator: boolean;
  requireParking: boolean;
  requireFurnished: boolean;
  matchCount: number | null;
  lat: number | null;
  lng: number | null;
  radius: number | null;
  queryText: string | null;
  source: string;
  searchedAt: string;
  createdAt: string;
};

function parseDistricts(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((d) => String(d).trim()).filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map((d) => String(d).trim()).filter(Boolean);
      }
    } catch {
      return value
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);
    }
  }
  return [];
}

export function shapeRadarSearchHistoryRow(
  row: RadarSearchHistory
): RadarSearchHistoryDto {
  return {
    id: row.id,
    eventType: row.eventType,
    transactionType: row.transactionType ?? null,
    propertyType: row.propertyType ?? null,
    city: row.city ?? null,
    selectedDistricts: parseDistricts(row.districts),
    maxPrice: row.maxPrice ?? null,
    minArea: row.minArea ?? null,
    minYear: row.minYear ?? null,
    requireBalcony: !!row.requireBalcony,
    requireGarden: !!row.requireGarden,
    requireElevator: !!row.requireElevator,
    requireParking: !!row.requireParking,
    requireFurnished: !!row.requireFurnished,
    matchCount: row.matchCount ?? null,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    radius: row.radius ?? null,
    queryText: row.queryText ?? null,
    source: row.source,
    searchedAt: row.searchedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export function shapeRadarSearchHistoryList(
  rows: RadarSearchHistory[]
): RadarSearchHistoryDto[] {
  return rows.map(shapeRadarSearchHistoryRow);
}

export function resolveRadarSearchHistoryLimit(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_RADAR_SEARCH_HISTORY_LIMIT;
  return Math.min(MAX_RADAR_SEARCH_HISTORY_LIMIT, Math.trunc(n));
}

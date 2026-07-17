"use client";

import { useEffect, useState } from "react";
import type { CatalogOption } from "@/lib/otomotoCatalog";

type CatalogFetchParams = Record<string, string | undefined>;

export const STATIC_FUEL_OPTIONS: CatalogOption[] = [
  { value: "petrol", label: "Benzyna" },
  { value: "petrol-lpg", label: "Benzyna+LPG" },
  { value: "diesel", label: "Diesel" },
  { value: "hybrid", label: "Hybryda" },
  { value: "plugin-hybrid", label: "Plug-In Hybryda" },
  { value: "electric", label: "Elektryczny" },
  { value: "cng", label: "CNG" },
  { value: "hydrogen", label: "Wodór" },
];

export const STATIC_GEARBOX_OPTIONS: CatalogOption[] = [
  { value: "automatic", label: "Automatyczna" },
  { value: "manual", label: "Manualna" },
];

async function fetchCatalogOptions(resource: string, params: CatalogFetchParams): Promise<CatalogOption[]> {
  const search = new URLSearchParams({ resource });
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });

  const response = await fetch(`/api/cars/catalog?${search.toString()}`, { credentials: "include" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return [];
  return Array.isArray(data?.options) ? data.options : [];
}

export function useCarCatalogOptions(
  resource: string,
  params: CatalogFetchParams,
  enabled = true,
) {
  const [options, setOptions] = useState<CatalogOption[]>([]);
  const [loading, setLoading] = useState(false);
  const serialized = JSON.stringify({ resource, params, enabled });

  useEffect(() => {
    if (!enabled) {
      setOptions([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchCatalogOptions(resource, params)
      .then((items) => {
        if (!cancelled) setOptions(items);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [serialized]);

  return { options, loading };
}

export function findOptionByLabel(options: CatalogOption[], label: string): CatalogOption | null {
  const normalized = label.trim().toLowerCase();
  if (!normalized) return null;
  return (
    options.find((item) => item.label.trim().toLowerCase() === normalized) ||
    options.find((item) => item.value.trim().toLowerCase() === normalized) ||
    options.find((item) => item.label.trim().toLowerCase().includes(normalized)) ||
    options.find((item) => normalized.includes(item.label.trim().toLowerCase())) ||
    null
  );
}

function firstNumber(raw: string): number | null {
  const match = String(raw || "").match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Otomoto catalog values are KM (e.g. value "184", label "184 KM (135 kW)"). */
export function findEnginePowerOption(options: CatalogOption[], label: string): CatalogOption | null {
  const direct = findOptionByLabel(options, label);
  if (direct) return direct;

  const kmFromLabel = label.match(/(\d+)\s*km\b/i);
  const kwFromLabel = label.match(/(\d+)\s*kw\b/i);
  const num = Number(kmFromLabel?.[1] || kwFromLabel?.[1] || firstNumber(label) || 0);
  if (!Number.isFinite(num) || num <= 0) return null;
  const rounded = String(Math.round(num));

  return (
    options.find((item) => item.value === rounded) ||
    options.find((item) => {
      const km = item.label.match(/(\d+)\s*km\b/i);
      return km != null && km[1] === rounded;
    }) ||
    options.find((item) => {
      const kw = item.label.match(/(\d+)\s*kw\b/i);
      return kw != null && kw[1] === rounded;
    }) ||
    null
  );
}

export function findEngineCapacityOption(options: CatalogOption[], label: string): CatalogOption | null {
  const direct = findOptionByLabel(options, label);
  if (direct) return direct;
  const cleaned = String(label || "").replace(/cm[³3]|ccm|\bcc\b/gi, " ");
  const cm3 = firstNumber(cleaned);
  if (cm3 == null) return null;
  const rounded = String(Math.round(cm3));
  return (
    options.find((item) => item.value === rounded) ||
    options.find((item) => item.label.replace(/[^\d]/g, "") === rounded) ||
    options.find((item) => item.label.toLowerCase().includes(`${rounded} cm`)) ||
    options.find((item) => item.label.toLowerCase().startsWith(rounded)) ||
    null
  );
}

export function mergeCatalogOptions(...lists: CatalogOption[][]): CatalogOption[] {
  const map = new Map<string, CatalogOption>();
  for (const list of lists) {
    for (const item of list) {
      const value = String(item.value || "").trim();
      const label = String(item.label || "").trim();
      if (!value || !label) continue;
      if (!map.has(value)) map.set(value, { value, label });
    }
  }
  return [...map.values()];
}

export function syntheticOptionFromLabel(label: string, preferredValue?: string): CatalogOption | null {
  const trimmed = label.trim();
  if (!trimmed && !preferredValue) return null;
  const value = (preferredValue || "").trim() || trimmed.toLowerCase().replace(/\s+/g, "-");
  if (!value) return null;
  return { value, label: trimmed || value };
}

export function resolveFuelOption(label: string, slug?: string): CatalogOption | null {
  if (slug) {
    const bySlug = STATIC_FUEL_OPTIONS.find((item) => item.value === slug);
    if (bySlug) return bySlug;
  }
  return findOptionByLabel(STATIC_FUEL_OPTIONS, label);
}

export function resolveGearboxOption(label: string, slug?: string): CatalogOption | null {
  if (slug) {
    const bySlug = STATIC_GEARBOX_OPTIONS.find((item) => item.value === slug);
    if (bySlug) return bySlug;
  }
  const normalized = label.trim().toLowerCase();
  if (normalized.includes("automat")) return STATIC_GEARBOX_OPTIONS[0];
  if (normalized.includes("manual")) return STATIC_GEARBOX_OPTIONS[1];
  return findOptionByLabel(STATIC_GEARBOX_OPTIONS, label);
}

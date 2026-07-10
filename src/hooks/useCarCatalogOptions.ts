"use client";

import { useEffect, useState } from "react";
import type { CatalogOption } from "@/lib/otomotoCatalog";

type CatalogFetchParams = Record<string, string | undefined>;

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

export function findEnginePowerOption(options: CatalogOption[], label: string): CatalogOption | null {
  const direct = findOptionByLabel(options, label);
  if (direct) return direct;
  const kw = Number(label.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(kw) || kw <= 0) return null;
  return (
    options.find((item) => item.label.replace(/[^\d.]/g, "") === String(kw)) ||
    options.find((item) => item.label.toLowerCase().includes(`${kw} kw`)) ||
    options.find((item) => item.label.toLowerCase().startsWith(`${kw}`)) ||
    null
  );
}

export function findEngineCapacityOption(options: CatalogOption[], label: string): CatalogOption | null {
  const direct = findOptionByLabel(options, label);
  if (direct) return direct;
  const cm3 = Number(label.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(cm3) || cm3 <= 0) return null;
  const rounded = String(Math.round(cm3));
  return (
    options.find((item) => item.label.replace(/[^\d.]/g, "") === rounded) ||
    options.find((item) => item.label.toLowerCase().includes(`${rounded} cm`)) ||
    options.find((item) => item.label.toLowerCase().startsWith(rounded)) ||
    null
  );
}

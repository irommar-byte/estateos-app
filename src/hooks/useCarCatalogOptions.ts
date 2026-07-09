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
    null
  );
}

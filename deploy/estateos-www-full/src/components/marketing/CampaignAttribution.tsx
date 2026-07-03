"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

const STORAGE_KEY = "estateos_campaign_ref";

/** Zapisuje UTM / ref z URL do sessionStorage — Tracker dołączy do /api/track. */
export default function CampaignAttribution() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const parts: string[] = [];
    const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "ref"] as const;
    for (const key of keys) {
      const value = searchParams.get(key)?.trim();
      if (value) parts.push(`${key}=${value}`);
    }
    if (!parts.length) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, parts.join("|"));
    } catch {
      /* ignore */
    }
  }, [searchParams]);

  return null;
}

export function readCampaignRef(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

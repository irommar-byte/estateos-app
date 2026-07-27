"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeDiscoveryUpdated } from "@/lib/discovery/clientEvents";

export type DiscoveryOfferBrief = {
  id: number;
  title: string;
  city: string | null;
  imageUrl: string | null;
};

export type DiscoveryProfilePayload = {
  likesCount: number;
  dislikesCount: number;
  fastTrackCount: number;
  opensCount: number;
  topCities: Array<{ key: string; value: number }>;
  topDistricts: Array<{ key: string; value: number }>;
  topPropertyTypes: Array<{ key: string; value: number }>;
  dislikeReasons: Array<{ key: string; value: number }>;
  preferredBudgetPln: number | null;
  preferredAreaM2: number | null;
  preferredTransaction: "SELL" | "RENT" | "MIXED" | null;
  summaryLine: string;
  confidence: number;
  contradictionIndex: number;
  explorationHunger: number;
  searchPhase: string;
  hasProfile: boolean;
  updatedAt: string | null;
};

export type DiscoveryTrope = {
  offerId: number;
  status: string;
  priority: boolean;
  updatedAt: string;
  offer: DiscoveryOfferBrief | null;
};

export type DiscoveryRecentEvent = {
  id: string;
  eventType: string;
  reasonCode: string | null;
  at: string;
  offer: DiscoveryOfferBrief | null;
};

export type DiscoveryGuidePayload = {
  intentStage?: string;
  intentLabel?: string;
  body?: string;
  stageProgress?: number;
  nextStep?: { title?: string; action?: string; offerId?: number | null };
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
};

function snapshotKey(input: {
  profile: DiscoveryProfilePayload | null;
  recent: DiscoveryRecentEvent[];
  guide: DiscoveryGuidePayload | null;
  tropes: DiscoveryTrope[];
}) {
  return JSON.stringify({
    u: input.profile?.updatedAt,
    l: input.profile?.likesCount,
    d: input.profile?.dislikesCount,
    f: input.profile?.fastTrackCount,
    o: input.profile?.opensCount,
    c: input.profile?.confidence,
    g: input.guide?.intentStage,
    t: input.guide?.nextStep?.title,
    r: input.recent[0]?.id,
    tr: input.tropes.map((x) => `${x.offerId}:${x.updatedAt}`).join(","),
  });
}

export function useDiscoveryProfile(opts?: {
  onNewDecision?: (eventType: string) => void;
}) {
  const onNewDecision = opts?.onNewDecision;
  const [auth, setAuth] = useState<"loading" | "guest" | "user">("loading");
  const [profile, setProfile] = useState<DiscoveryProfilePayload | null>(null);
  const [tropes, setTropes] = useState<DiscoveryTrope[]>([]);
  const [recent, setRecent] = useState<DiscoveryRecentEvent[]>([]);
  const [guide, setGuide] = useState<DiscoveryGuidePayload | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevTopEventId = useRef<string | null>(null);
  const snapshotRef = useRef("");

  const load = useCallback(
    async (loadOpts?: { silent?: boolean; force?: boolean }) => {
      if (!loadOpts?.silent) setRefreshing(true);
      try {
        const res = await fetch("/api/discovery/profile", {
          credentials: "include",
          cache: "no-store",
        });
        if (res.status === 401) {
          setAuth("guest");
          setProfile(null);
          return;
        }
        if (!res.ok) {
          if (!loadOpts?.silent) setError("Nie udało się wczytać danych.");
          return;
        }
        const data = await res.json();
        const nextProfile = (data.profile || null) as DiscoveryProfilePayload | null;
        const nextTropes: DiscoveryTrope[] = Array.isArray(data.tropes) ? data.tropes : [];
        const nextRecent: DiscoveryRecentEvent[] = Array.isArray(data.recent) ? data.recent : [];
        const nextGuide = (data.guide || null) as DiscoveryGuidePayload | null;
        const nextKey = snapshotKey({
          profile: nextProfile,
          recent: nextRecent,
          guide: nextGuide,
          tropes: nextTropes,
        });

        const topId = nextRecent[0]?.id || null;
        if (
          loadOpts?.silent &&
          topId &&
          prevTopEventId.current &&
          topId !== prevTopEventId.current
        ) {
          onNewDecision?.(nextRecent[0].eventType);
        }
        if (topId) prevTopEventId.current = topId;

        if (!loadOpts?.force && nextKey === snapshotRef.current) {
          setAuth("user");
          setError(null);
          return;
        }

        snapshotRef.current = nextKey;
        setAuth("user");
        setProfile(nextProfile);
        setTropes(nextTropes);
        setRecent(nextRecent);
        setGuide(nextGuide);
        setError(null);
      } catch {
        if (!loadOpts?.silent) setError("Brak połączenia.");
      } finally {
        setRefreshing(false);
      }
    },
    [onNewDecision],
  );

  useEffect(() => {
    void load({ force: true });
  }, [load]);

  useEffect(() => subscribeDiscoveryUpdated(() => void load({ silent: true })), [load]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void load({ silent: true });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  return {
    auth,
    profile,
    tropes,
    recent,
    guide,
    refreshing,
    error,
    reload: load,
  };
}

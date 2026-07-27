"use client";

import { useEffect, useState } from "react";
import DiscoveryIntelligenceWhisper from "@/components/discovery/DiscoveryIntelligenceWhisper";
import { useIntelligencePreference } from "@/contexts/IntelligencePreferenceContext";

type Props = {
  offerId: number | string;
  className?: string;
};

/**
 * Soft suggest / discourage visit — one line near offer CTAs.
 */
export default function DiscoveryVisitHint({ offerId, className }: Props) {
  const { enabled, hydrated } = useIntelligencePreference();
  const [hint, setHint] = useState<{ body: string; href: string } | null>(null);

  useEffect(() => {
    if (!hydrated || !enabled) {
      setHint(null);
      return;
    }
    const id = Number(offerId);
    if (!Number.isFinite(id) || id <= 0) return;
    let cancelled = false;

    void fetch(`/api/discovery/for-you?offerId=${id}&limit=1`, {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (res) => {
        if (res.status === 401 || !res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (cancelled || !data) return;
        const score = Number(data?.explain?.score);
        const ready = Boolean(data?.profile?.ready);
        if (!ready && !(Number.isFinite(score) && score > 0)) return;

        if (Number.isFinite(score) && score >= 55) {
          setHint({
            body: "Ten trop dobrze rezonuje z Twoim kierunkiem — wizyta może być spokojnym następnym krokiem.",
            href: "/moj-kierunek",
          });
        } else if (Number.isFinite(score) && score > 0 && score < 22) {
          setHint({
            body: "Słabe dopasowanie do dotychczasowych wyborów. Lepiej doprecyzować kierunek przed wizytą.",
            href: "/lustro",
          });
        } else if (data?.explain?.reason) {
          setHint({
            body: "Warto spokojnie pogłębić ten trop przed kontaktem — bez pośpiechu.",
            href: "/moj-kierunek",
          });
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [offerId, enabled, hydrated]);

  if (!hydrated || !enabled || !hint) return null;

  return (
    <DiscoveryIntelligenceWhisper
      variant="inline"
      body={hint.body}
      href={hint.href}
      className={className || "mb-3"}
    />
  );
}

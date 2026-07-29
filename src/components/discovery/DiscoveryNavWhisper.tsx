"use client";

import { useEffect, useState } from "react";
import DiscoveryIntelligenceWhisper from "@/components/discovery/DiscoveryIntelligenceWhisper";
import { useDiscoveryPulseLite } from "@/hooks/useDiscoveryPulseLite";
import { useIntelligencePreference } from "@/contexts/IntelligencePreferenceContext";
import { subscribeIntelligenceSheetOpen } from "@/lib/discovery/clientEvents";

type Props = {
  variant?: "nav" | "drawer";
  className?: string;
};

/** Navbar / drawer ambient direction — hides when pulse sheet is speaking. */
export default function DiscoveryNavWhisper({ variant = "nav", className }: Props) {
  const { enabled, hydrated } = useIntelligencePreference();
  const { pulse, auth } = useDiscoveryPulseLite();
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => subscribeIntelligenceSheetOpen(setSheetOpen), []);

  if (!hydrated || !enabled || auth !== "user" || !pulse || sheetOpen) return null;

  const line =
    pulse.confidence >= 0.12
      ? pulse.directionLine || pulse.suggestion
      : pulse.progress > 0
        ? pulse.suggestion || pulse.directionLine
        : "";

  if (!line || line.length < 8) return null;

  return (
    <DiscoveryIntelligenceWhisper
      variant={variant}
      body={line}
      href="/moj-kierunek"
      className={className}
    />
  );
}

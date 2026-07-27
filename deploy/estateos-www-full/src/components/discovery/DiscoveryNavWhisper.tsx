"use client";

import DiscoveryIntelligenceWhisper from "@/components/discovery/DiscoveryIntelligenceWhisper";
import { useDiscoveryPulseLite } from "@/hooks/useDiscoveryPulseLite";
import { useIntelligencePreference } from "@/contexts/IntelligencePreferenceContext";

type Props = {
  variant?: "nav" | "drawer";
  className?: string;
};

/** Navbar / drawer ambient direction — hides when nothing useful to say. */
export default function DiscoveryNavWhisper({ variant = "nav", className }: Props) {
  const { enabled, hydrated } = useIntelligencePreference();
  const { pulse, auth } = useDiscoveryPulseLite();
  if (!hydrated || !enabled || auth !== "user" || !pulse) return null;

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

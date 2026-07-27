"use client";

import DiscoveryIntelligenceWhisper from "@/components/discovery/DiscoveryIntelligenceWhisper";
import { useDiscoveryPulseLite } from "@/hooks/useDiscoveryPulseLite";

type Props = {
  variant?: "nav" | "drawer";
  className?: string;
};

/** Navbar / drawer ambient direction — hides when nothing useful to say. */
export default function DiscoveryNavWhisper({ variant = "nav", className }: Props) {
  const { pulse, auth } = useDiscoveryPulseLite();
  if (auth !== "user" || !pulse) return null;

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

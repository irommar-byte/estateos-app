"use client";

import DiscoveryIntelligenceWhisper from "@/components/discovery/DiscoveryIntelligenceWhisper";
import { useDiscoveryPulseLite } from "@/hooks/useDiscoveryPulseLite";

type Props = {
  /** When true, prefer discourage tone for contact/visit. */
  beforeContact?: boolean;
  className?: string;
};

/**
 * Calm pre-contact / pre-visit whisper from pulse suggestion.
 */
export default function DiscoveryContactWhisper({ beforeContact = true, className }: Props) {
  const { pulse, auth } = useDiscoveryPulseLite();
  if (auth !== "user" || !pulse) return null;
  if (pulse.confidence < 0.1 && pulse.progress < 15) return null;

  const contradiction = pulse.contradictionIndex >= 0.55;
  const body = contradiction
    ? "Sygnały się mieszają. Spokojnie doprecyzuj kierunek zanim napiszesz lub umówisz wizytę."
    : beforeContact
      ? pulse.suggestion ||
        "Masz trop, który warto spokojnie pogłębić przed kontaktem."
      : pulse.directionLine || pulse.suggestion;

  if (!body) return null;

  return (
    <DiscoveryIntelligenceWhisper
      variant="inline"
      body={body}
      href={contradiction ? "/lustro" : "/moj-kierunek"}
      className={className}
    />
  );
}

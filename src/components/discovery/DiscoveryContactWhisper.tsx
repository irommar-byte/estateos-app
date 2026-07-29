import React, { useEffect, useState } from 'react';
import DiscoveryIntelligenceWhisper from './DiscoveryIntelligenceWhisper';
import { useDiscoveryPulse } from '../../hooks/useDiscoveryPulse';
import {
  isIntelligenceSheetOpen,
  subscribeIntelligenceSheetOpen,
} from '../../lib/discovery/clientEvents';
import { useIntelligencePreferenceStore } from '../../store/useIntelligencePreferenceStore';
import { useAuthStore } from '../../store/useAuthStore';

type Props = {
  navigation?: any;
  beforeContact?: boolean;
  style?: object;
  isDark?: boolean;
};

/**
 * Calm pre-contact / pre-visit whisper from pulse suggestion.
 */
export default function DiscoveryContactWhisper({
  navigation,
  beforeContact = true,
  style,
  isDark,
}: Props) {
  const token = useAuthStore((s) => s.token);
  const enabled = useIntelligencePreferenceStore((s) => s.enabled);
  const hydrated = useIntelligencePreferenceStore((s) => s.hydrated);
  const { pulse, ready } = useDiscoveryPulse();
  const [sheetOpen, setSheetOpen] = useState(isIntelligenceSheetOpen);

  useEffect(() => subscribeIntelligenceSheetOpen(setSheetOpen), []);

  if (sheetOpen) return null;
  if (!hydrated || !enabled || !token || !ready || !pulse) return null;
  if (pulse.confidence < 0.1 && pulse.progress < 15) return null;

  const contradiction = pulse.contradictionIndex >= 0.55;
  const body = contradiction
    ? 'Sygnały się mieszają. Spokojnie doprecyzuj kierunek zanim napiszesz lub umówisz wizytę.'
    : beforeContact
      ? pulse.suggestion || 'Masz trop, który warto spokojnie pogłębić przed kontaktem.'
      : pulse.directionLine || pulse.suggestion;

  if (!body) return null;

  return (
    <DiscoveryIntelligenceWhisper
      navigation={navigation}
      variant="inline"
      body={body}
      href={contradiction ? '/lustro' : '/moj-kierunek'}
      style={style}
      isDark={isDark}
    />
  );
}

import React from 'react';
import DiscoveryIntelligenceWhisper from './DiscoveryIntelligenceWhisper';
import { useDiscoveryPulse } from '../../hooks/useDiscoveryPulse';
import { useIntelligencePreferenceStore } from '../../store/useIntelligencePreferenceStore';
import { useAuthStore } from '../../store/useAuthStore';

type Props = {
  navigation?: any;
  variant?: 'nav' | 'drawer';
  style?: object;
};

/**
 * Quiet direction line from pulse for chrome / drawer.
 */
export default function DiscoveryNavWhisper({ navigation, variant = 'nav', style }: Props) {
  const token = useAuthStore((s) => s.token);
  const enabled = useIntelligencePreferenceStore((s) => s.enabled);
  const hydrated = useIntelligencePreferenceStore((s) => s.hydrated);
  const { pulse, ready } = useDiscoveryPulse();

  if (!hydrated || !enabled || !token || !ready || !pulse) return null;

  const line =
    pulse.confidence >= 0.12
      ? pulse.directionLine || pulse.suggestion
      : pulse.progress > 0
        ? pulse.suggestion || pulse.directionLine
        : '';

  if (String(line).trim().length < 8) return null;

  return (
    <DiscoveryIntelligenceWhisper
      navigation={navigation}
      variant={variant}
      body={line}
      href="/moj-kierunek"
      style={style}
    />
  );
}

import React, { useCallback, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import ApplePressable from '../ApplePressable';
import { DISCOVERY_COLORS } from './discoveryMotion';
import { useDiscoveryPulse } from '../../hooks/useDiscoveryPulse';
import { useDiscoveryStore } from '../../store/useDiscoveryStore';
import { resolveDiscoveryEntryRoute } from '../../utils/discoveryExperienceState';

type Props = {
  navigation: any;
};

type Mood = 'calm' | 'active' | 'alert';

function resolveMood(progress: number, confidence: number, contradiction: number): Mood {
  if (contradiction >= 0.55) return 'alert';
  if (progress >= 35 || confidence >= 0.35) return 'active';
  return 'calm';
}

const MOOD: Record<Mood, { accent: string; glow: string }> = {
  calm: { accent: '#34D399', glow: 'rgba(52,211,153,0.22)' },
  active: { accent: '#38BDF8', glow: 'rgba(56,189,248,0.22)' },
  alert: { accent: '#FBBF24', glow: 'rgba(251,191,36,0.26)' },
};

function navigatePulseAction(navigation: any, action: string | undefined, firstEntrySeen: boolean) {
  const discoveryRoute = resolveDiscoveryEntryRoute(firstEntrySeen);
  switch (String(action || 'DISCOVERY').toUpperCase()) {
    case 'TROPES':
      navigation?.navigate?.('DiscoveryTropes');
      return;
    case 'DIRECTION':
    case 'LUSTRO':
    case 'PROFILE':
      navigation?.navigate?.('DiscoveryResume');
      return;
    case 'MAP':
      navigation?.navigate?.('MainTabs', { screen: 'Explore' });
      return;
    case 'CONTACT':
      navigation?.navigate?.('MainTabs', { screen: 'Wiadomości' });
      return;
    case 'DISCOVERY':
    default:
      navigation?.navigate?.(discoveryRoute);
  }
}

/**
 * Thin Inteligence tape — pulse from the same API as WWW, no genie/whispers.
 */
export default function IntelligencePulseTape({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { pulse, ready } = useDiscoveryPulse();
  const firstEntrySeen = useDiscoveryStore((s) => s.firstEntrySeen);
  const [expanded, setExpanded] = useState(false);

  const mood = useMemo(() => {
    if (!pulse) return 'calm' as Mood;
    return resolveMood(pulse.progress, pulse.confidence, pulse.contradictionIndex);
  }, [pulse]);
  const colors = MOOD[mood];

  const toggle = useCallback(() => {
    void Haptics.selectionAsync();
    setExpanded((prev) => !prev);
  }, []);

  if (!ready || !pulse) return null;

  const bottom = Math.max(insets.bottom, Platform.OS === 'ios' ? 8 : 10) + 64;

  return (
    <View pointerEvents="box-none" style={[styles.root, { bottom }]}>
      <BlurView intensity={78} tint="dark" style={[styles.tape, { borderColor: colors.accent + '55' }]}>
        <View style={[styles.glow, { backgroundColor: colors.glow }]} />
        <ApplePressable onPress={toggle} style={styles.collapsed} accessibilityLabel="EstateOS Inteligence Pulse">
          <View style={[styles.orb, { borderColor: colors.accent }]}>
            <Ionicons name="sparkles" size={14} color={colors.accent} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.kicker}>Inteligence · {pulse.stageLabel}</Text>
            <Text style={styles.direction} numberOfLines={expanded ? 3 : 1}>
              {pulse.directionLine || pulse.suggestion}
            </Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.max(6, pulse.progress)}%`, backgroundColor: colors.accent },
                ]}
              />
            </View>
          </View>
          <Ionicons
            name={expanded ? 'chevron-down' : 'chevron-up'}
            size={16}
            color={DISCOVERY_COLORS.textMuted}
          />
        </ApplePressable>

        {expanded ? (
          <View style={styles.expanded}>
            <Text style={styles.suggestion}>{pulse.suggestion}</Text>
            <ApplePressable
              style={[styles.cta, { backgroundColor: colors.accent }]}
              haptic="medium"
              onPress={() => {
                setExpanded(false);
                navigatePulseAction(navigation, pulse.primaryCta?.action, firstEntrySeen);
              }}
            >
              <Text style={styles.ctaText}>{pulse.primaryCta?.label || 'Kontynuuj Discovery'}</Text>
            </ApplePressable>
          </View>
        ) : null}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 14,
    right: 14,
    zIndex: 40,
  },
  tape: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: 'rgba(8,8,10,0.55)',
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.9,
  },
  collapsed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  orb: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  copy: { flex: 1, minWidth: 0 },
  kicker: {
    color: DISCOVERY_COLORS.gold,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  direction: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginTop: 7,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  expanded: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 12,
  },
  suggestion: {
    color: DISCOVERY_COLORS.ivory,
    fontSize: 13,
    lineHeight: 19,
    opacity: 0.92,
  },
  cta: {
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: '#061018',
    fontSize: 14,
    fontWeight: '900',
  },
});

import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { DISCOVERY_COLORS, DISCOVERY_MOTION } from './discoveryMotion';

export type DiscoveryIslandState =
  | { kind: 'idle'; hint?: string }
  | { kind: 'decision'; decision: 'LIKE' | 'DISLIKE' | 'PRIORITY' }
  | { kind: 'undo'; onUndo: () => void }
  | { kind: 'saved' }
  | { kind: 'insight'; onOpen: () => void }
  | { kind: 'pause'; onOpen: () => void };

type Props = {
  state: DiscoveryIslandState;
  onBack: () => void;
};

const decisionMeta = {
  LIKE: { icon: 'heart' as const, label: 'Wybrane', color: DISCOVERY_COLORS.green },
  DISLIKE: { icon: 'close' as const, label: 'Pominięte', color: '#D0D0D4' },
  PRIORITY: { icon: 'flash' as const, label: 'Ważny trop', color: DISCOVERY_COLORS.gold },
};

export default function DiscoverySessionIsland({ state, onBack }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    scale.setValue(0.96);
    opacity.setValue(0.65);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 150, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: DISCOVERY_MOTION.island, useNativeDriver: true }),
    ]).start();
  }, [opacity, scale, state.kind]);

  const content = useMemo(() => {
    if (state.kind === 'decision') {
      const meta = decisionMeta[state.decision];
      return (
        <>
          <Ionicons name={meta.icon} size={15} color={meta.color} />
          <Text style={[styles.label, { color: meta.color }]}>{meta.label}</Text>
        </>
      );
    }
    if (state.kind === 'undo') {
      return <Text style={[styles.label, styles.primary]}>Cofnij</Text>;
    }
    if (state.kind === 'saved') {
      return (
        <>
          <Ionicons name="bookmark" size={15} color={DISCOVERY_COLORS.gold} />
          <Text style={[styles.label, styles.primary]}>Zapisano</Text>
        </>
      );
    }
    if (state.kind === 'insight') {
      return (
        <>
          <Ionicons name="sparkles" size={15} color={DISCOVERY_COLORS.gold} />
          <Text style={[styles.label, styles.primary]}>Dlaczego?</Text>
        </>
      );
    }
    if (state.kind === 'pause') {
      return <Text style={[styles.label, styles.primary]}>Na dziś wystarczy</Text>;
    }
    return (
      <>
        <View style={styles.liveDot} />
        <Text style={styles.label}>Discovery™</Text>
        {state.hint ? <Text style={styles.hint} numberOfLines={1}>{state.hint}</Text> : null}
      </>
    );
  }, [state]);

  const actionable = state.kind === 'undo' || state.kind === 'insight' || state.kind === 'pause';
  const onPress = state.kind === 'undo'
    ? state.onUndo
    : state.kind === 'insight'
      ? state.onOpen
      : state.kind === 'pause'
        ? state.onOpen
        : undefined;

  return (
    <Animated.View style={[styles.wrap, { opacity, transform: [{ scale }] }]}>
      <Pressable onPress={onBack} style={styles.back} accessibilityLabel="Wróć" accessibilityRole="button">
        <Ionicons name="chevron-back" size={17} color="#FFF" />
      </Pressable>
      <Pressable
        style={[styles.island, actionable && styles.actionable]}
        onPress={onPress}
        disabled={!actionable}
        accessibilityRole={actionable ? 'button' : 'text'}
        accessibilityLabel={state.kind === 'undo' ? 'Cofnij ostatnią decyzję' : state.kind === 'insight' ? 'Dlaczego ta oferta' : 'Pauza sesji'}
      >
        <BlurView intensity={65} tint="dark" style={styles.blur}>
          {content}
        </BlurView>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 54,
    left: 18,
    right: 18,
    zIndex: 40,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  back: {
    position: 'absolute',
    left: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(12,12,14,0.6)',
    borderWidth: 1,
    borderColor: DISCOVERY_COLORS.glassBorder,
  },
  island: {
    minHeight: 38,
    maxWidth: '82%',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: DISCOVERY_COLORS.glassBorder,
  },
  actionable: {
    borderColor: 'rgba(212,175,55,0.55)',
  },
  blur: {
    minHeight: 36,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: 'rgba(14,14,16,0.7)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: DISCOVERY_COLORS.gold,
  },
  label: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
  },
  primary: {
    color: DISCOVERY_COLORS.ivory,
  },
  hint: {
    color: DISCOVERY_COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
    maxWidth: 158,
  },
});

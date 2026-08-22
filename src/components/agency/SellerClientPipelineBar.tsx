import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SellerPipelineStage, SellerPipelineStageId } from '../../lib/sellerClientPipeline';

const STAGE_ICONS: Record<SellerPipelineStageId, keyof typeof Ionicons.glyphMap> = {
  meeting: 'call',
  acquisition: 'document-text',
  sale: 'home',
  transaction: 'briefcase',
  finalization: 'key',
};

const SHORT_LABELS: Record<SellerPipelineStageId, string> = {
  meeting: 'Spotkanie',
  acquisition: 'Pozysk',
  sale: 'Sprzedaż',
  transaction: 'Transakcja',
  finalization: 'Finalizacja',
};

const DOT = 22;
const RAIL = 4;

function AnimatedPhoneIcon({ active }: { active: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const wobble = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      pulse.setValue(1);
      wobble.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.12, duration: 680, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 680, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(wobble, { toValue: 1, duration: 320, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(wobble, { toValue: -1, duration: 320, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(wobble, { toValue: 0, duration: 320, easing: Easing.linear, useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse, wobble]);

  const rotate = wobble.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-12deg', '12deg'],
  });

  return (
    <Animated.View style={{ transform: [{ scale: pulse }, { rotate }] }}>
      <Ionicons name="call" size={11} color="#fff" />
    </Animated.View>
  );
}

type Props = {
  stages: SellerPipelineStage[];
  isDark?: boolean;
  compact?: boolean;
};

export default function SellerClientPipelineBar({ stages, isDark, compact }: Props) {
  const [trackW, setTrackW] = useState(0);
  const doneCount = stages.filter((s) => s.done).length;
  const n = Math.max(stages.length, 1);
  const segments = Math.max(1, n - 1);
  const reached = stages.every((s) => s.done) ? n - 1 : Math.max(0, doneCount);
  const progressPct = reached / segments;
  const colW = trackW / n;
  const railLeft = colW / 2;
  const railWidth = Math.max(0, trackW - colW);
  const fillWidth = railWidth * progressPct;
  const rail = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.1)';

  return (
    <View
      style={[
        styles.wrap,
        compact && styles.wrapCompact,
        {
          backgroundColor: isDark ? 'rgba(52,199,89,0.1)' : 'rgba(52,199,89,0.07)',
          shadowColor: isDark ? '#000' : '#14532d',
        },
      ]}
    >
      <View
        style={styles.trackRow}
        onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
      >
        {trackW > 0 ? (
          <View
            pointerEvents="none"
            style={[
              styles.railWrap,
              {
                left: railLeft,
                width: railWidth,
                top: DOT / 2 - RAIL / 2,
              },
            ]}
          >
            <View style={[styles.rail, { backgroundColor: rail }]} />
            <View style={[styles.railFill, { width: fillWidth }]} />
          </View>
        ) : null}
        {stages.map((stage) => {
          const iconName = STAGE_ICONS[stage.id];
          const isPhoneActive = stage.id === 'meeting' && stage.current && !stage.done;
          return (
            <View key={stage.id} style={styles.stepCol}>
              <View
                style={[
                  styles.dot,
                  stage.done
                    ? styles.dotDone
                    : stage.current
                      ? styles.dotCurrent
                      : [
                          styles.dotIdle,
                          {
                            borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(15,23,42,0.14)',
                            backgroundColor: isDark ? '#1C1C1E' : '#fff',
                          },
                        ],
                ]}
              >
                {stage.done ? (
                  <Ionicons name="checkmark" size={11} color="#fff" />
                ) : isPhoneActive ? (
                  <AnimatedPhoneIcon active />
                ) : (
                  <Ionicons
                    name={iconName}
                    size={11}
                    color={stage.current ? '#fff' : isDark ? '#8E8E93' : '#9CA3AF'}
                  />
                )}
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  {
                    color: stage.done
                      ? '#34C759'
                      : stage.current
                        ? isDark
                          ? '#fff'
                          : '#111'
                        : isDark
                          ? '#8E8E93'
                          : '#6C6C70',
                    fontWeight: stage.current || stage.done ? '800' : '600',
                  },
                ]}
                numberOfLines={1}
              >
                {SHORT_LABELS[stage.id]}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 6,
    borderRadius: 14,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  wrapCompact: { marginTop: 8, paddingTop: 8, paddingBottom: 6 },
  trackRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  railWrap: {
    position: 'absolute',
    height: RAIL,
    overflow: 'hidden',
    borderRadius: 99,
  },
  rail: { ...StyleSheet.absoluteFillObject, borderRadius: 99 },
  railFill: {
    height: RAIL,
    borderRadius: 99,
    backgroundColor: '#34C759',
    shadowColor: '#34C759',
    shadowOpacity: 0.55,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  stepCol: { flex: 1, alignItems: 'center', zIndex: 1 },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    shadowColor: '#14532d',
    shadowOpacity: 0.22,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  dotDone: { backgroundColor: '#34C759', borderColor: '#34C759' },
  dotCurrent: { backgroundColor: '#059669', borderColor: '#A7F3D0' },
  dotIdle: {},
  stepLabel: { marginTop: 5, fontSize: 8, textAlign: 'center', letterSpacing: -0.1 },
});

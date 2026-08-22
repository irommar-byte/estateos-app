import React, { useEffect, useRef } from 'react';
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
  const doneCount = stages.filter((s) => s.done).length;
  const progressPct = stages.length ? (doneCount / stages.length) * 100 : 0;
  const current = stages.find((s) => s.current);

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <Text style={[styles.kicker, { color: isDark ? '#8E8E93' : '#6C6C70' }]}>Proces sprzedaży</Text>
        {current ? (
          <Text style={[styles.currentLabel, { color: isDark ? '#fff' : '#111' }]} numberOfLines={1}>
            {current.label}
          </Text>
        ) : null}
      </View>

      <View
        style={[
          styles.track,
          { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' },
        ]}
      >
        <View style={[styles.fill, { width: `${Math.max(8, progressPct)}%` }]} />
      </View>

      <View style={styles.row}>
        {stages.map((stage, index) => {
          const iconName = STAGE_ICONS[stage.id];
          const isPhoneActive = stage.id === 'meeting' && stage.current && !stage.done;
          return (
            <React.Fragment key={stage.id}>
              <View style={styles.stepCol}>
                <View
                  style={[
                    styles.dot,
                    stage.done
                      ? styles.dotDone
                      : stage.current
                        ? styles.dotCurrent
                        : [styles.dotIdle, { borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)' }],
                  ]}
                >
                  {stage.done ? (
                    <Ionicons name="checkmark" size={12} color="#fff" />
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
                {!compact ? (
                  <Text
                    style={[
                      styles.stepLabel,
                      {
                        color: stage.done ? '#34C759' : stage.current ? (isDark ? '#fff' : '#111') : isDark ? '#8E8E93' : '#6C6C70',
                        fontWeight: stage.current ? '800' : '600',
                      },
                    ]}
                    numberOfLines={2}
                  >
                    {stage.label}
                  </Text>
                ) : null}
              </View>
              {index < stages.length - 1 ? (
                <View
                  style={[
                    styles.connector,
                    {
                      backgroundColor: stage.done
                        ? '#34C759'
                        : isDark
                          ? 'rgba(255,255,255,0.12)'
                          : 'rgba(0,0,0,0.1)',
                    },
                  ]}
                />
              ) : null}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10 },
  titleRow: { marginBottom: 8, gap: 2 },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase' },
  currentLabel: { fontSize: 13, fontWeight: '800', letterSpacing: -0.2 },
  track: { height: 4, borderRadius: 999, overflow: 'hidden', marginBottom: 12 },
  fill: { height: '100%', borderRadius: 999, backgroundColor: '#34C759' },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  stepCol: { flex: 1, alignItems: 'center', minWidth: 0, paddingHorizontal: 1 },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  dotDone: { backgroundColor: '#34C759', borderColor: '#34C759' },
  dotCurrent: { backgroundColor: '#059669', borderColor: '#6EE7B7' },
  dotIdle: { backgroundColor: 'transparent' },
  stepLabel: { marginTop: 5, fontSize: 8.5, textAlign: 'center', lineHeight: 11 },
  connector: { height: 3, flex: 0.35, borderRadius: 2, marginTop: 11.5, marginHorizontal: -2 },
});

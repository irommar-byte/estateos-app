import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type StepItem = {
  id: number;
  title: string;
};

const DOT = 28;
const RAIL = 4;

export default function AcquisitionStepIndicator({
  steps,
  currentStep,
  completedSteps = [],
  errorSteps = [],
  onSelectStep,
  isDark,
  locked,
}: {
  steps: StepItem[];
  currentStep: number;
  completedSteps?: number[];
  errorSteps?: number[];
  onSelectStep: (stepId: number) => void;
  isDark?: boolean;
  locked?: boolean;
}) {
  const [trackW, setTrackW] = useState(0);
  const n = Math.max(steps.length, 1);
  const reached = locked ? n - 1 : Math.max(0, Math.min(n - 1, currentStep - 1));
  const colW = trackW / n;
  const railLeft = colW / 2;
  const railWidth = Math.max(0, trackW - colW);
  const fillWidth = railWidth * (reached / Math.max(n - 1, 1));
  const rail = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.12)';

  return (
    <View style={styles.wrap}>
      <View style={styles.track} onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}>
        {trackW > 0 ? (
          <View pointerEvents="none" style={[styles.railWrap, { left: railLeft, width: railWidth, top: DOT / 2 - RAIL / 2 }]}>
            <View style={[styles.rail, { backgroundColor: rail }]} />
            <View style={[styles.railFill, { width: fillWidth }]} />
          </View>
        ) : null}
        {steps.map((step) => {
          const isActive = step.id === currentStep;
          const isDone = completedSteps.includes(step.id) || step.id < currentStep || (locked && step.id <= 7 && !isActive);
          const isError = errorSteps.includes(step.id);
          return (
            <Pressable key={step.id} onPress={() => onSelectStep(step.id)} style={styles.stepCol}>
              <View
                style={[
                  styles.dot,
                  isError
                    ? styles.dotError
                    : isDone || (locked && step.id < 7)
                      ? styles.dotDone
                      : isActive
                        ? styles.dotCurrent
                        : [styles.dotIdle, { borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(15,23,42,0.14)', backgroundColor: isDark ? '#1C1C1E' : '#fff' }],
                ]}
              >
                {isDone || (locked && step.id < 7) || (locked && step.id === 7 && !isActive) ? (
                  <Ionicons name="checkmark" size={15} color="#fff" />
                ) : (
                  <Text style={[styles.num, { color: isActive ? '#fff' : isDark ? '#8E8E93' : '#9CA3AF' }]}>{step.id}</Text>
                )}
              </View>
              <Text
                numberOfLines={2}
                style={[
                  styles.title,
                  {
                    color: isError ? '#FF3B30' : isDone || isActive ? (isDark ? '#fff' : '#111') : isDark ? '#8E8E93' : '#6C6C70',
                    fontWeight: isActive || isDone ? '800' : '600',
                  },
                ]}
              >
                {step.title}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: 8, paddingHorizontal: 2 },
  track: { position: 'relative', flexDirection: 'row', alignItems: 'flex-start' },
  railWrap: { position: 'absolute', height: RAIL, overflow: 'hidden', borderRadius: 99 },
  rail: { ...StyleSheet.absoluteFillObject, borderRadius: 99 },
  railFill: {
    height: RAIL,
    borderRadius: 99,
    backgroundColor: '#34C759',
    shadowColor: '#34C759',
    shadowOpacity: 0.5,
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
  dotError: { backgroundColor: '#FF3B30', borderColor: '#FF3B30' },
  dotIdle: {},
  num: { fontSize: 12, fontWeight: '800' },
  title: { marginTop: 6, fontSize: 9, textAlign: 'center', lineHeight: 11, paddingHorizontal: 1 },
});

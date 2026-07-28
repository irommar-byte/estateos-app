import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import ApplePressable from '../ApplePressable';

export type SlidingIconOption<T extends string> = {
  key: T;
  icon: keyof typeof Ionicons.glyphMap;
  accessibilityLabel?: string;
};

type Props<T extends string> = {
  options: SlidingIconOption<T>[];
  value: T;
  onChange: (next: T) => void;
  isDark: boolean;
  accent?: string;
  /** Optional label row above (e.g. WIDOK). */
  label?: React.ReactNode;
};

const SPRING = { damping: 18, stiffness: 240, mass: 0.72 };

/**
 * Apple-style segmented control: N icons with a smoothly sliding pill.
 * Used for Cover/Lista/Siatka and Market tape density.
 */
export default function SlidingIconSegment<T extends string>({
  options,
  value,
  onChange,
  isDark,
  accent = '#6366F1',
  label,
}: Props<T>) {
  const [trackWidth, setTrackWidth] = useState(0);
  const index = Math.max(
    0,
    options.findIndex((o) => o.key === value),
  );
  const pillX = useSharedValue(index);

  useEffect(() => {
    pillX.value = withSpring(index, SPRING);
  }, [index, pillX]);

  const onTrackLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  };

  const count = Math.max(options.length, 1);
  const pillW = Math.max(0, (trackWidth - 4) / count);

  const pillStyle = useAnimatedStyle(() => ({
    width: pillW,
    transform: [{ translateX: pillX.value * pillW }],
    backgroundColor: isDark ? `${accent}66` : `${accent}33`,
  }));

  return (
    <View style={styles.wrap}>
      {label ? <View style={styles.labelSlot}>{label}</View> : null}
      <View
        style={[
          styles.track,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.72)',
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.08)',
          },
        ]}
        onLayout={onTrackLayout}
      >
        {pillW > 0 ? <Animated.View style={[styles.pill, pillStyle]} /> : null}
        {options.map((opt) => {
          const selected = value === opt.key;
          return (
            <ApplePressable
              key={opt.key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={opt.accessibilityLabel || opt.key}
              haptic="selection"
              pressScale={0.94}
              onPress={() => {
                if (!selected) onChange(opt.key);
              }}
              style={styles.btn}
            >
              <Ionicons name={opt.icon} size={16} color={selected ? accent : '#8E8E93'} />
            </ApplePressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  labelSlot: { flexShrink: 0 },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  pill: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 2,
    borderRadius: 12,
  },
  btn: {
    minWidth: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
});

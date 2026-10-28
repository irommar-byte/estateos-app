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
  }));

  return (
    <View style={styles.wrap}>
      {label ? <View style={styles.labelSlot}>{label}</View> : null}
      <View
        style={[
          styles.track,
          {
            backgroundColor: isDark ? 'rgba(118,118,128,0.24)' : 'rgba(118,118,128,0.12)',
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.08)',
          },
        ]}
        onLayout={onTrackLayout}
      >
        {pillW > 0 ? (
          <Animated.View
            style={[
              styles.pill,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.16)' : '#FFFFFF',
                borderColor: isDark ? `${accent}88` : `${accent}40`,
              },
              pillStyle,
            ]}
          />
        ) : null}
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
              <Ionicons name={opt.icon} size={17} color={selected ? accent : isDark ? 'rgba(235,235,245,0.6)' : '#6B7280'} />
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
  },
  pill: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 2,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 2,
  },
  btn: {
    minWidth: 46,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
});

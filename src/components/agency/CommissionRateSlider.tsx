import React, { useMemo, useRef } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  COMMISSION_RATE_DEFAULT,
  COMMISSION_RATE_MAX,
  COMMISSION_RATE_MIN,
  COMMISSION_RATE_STEP,
  formatCommissionRate,
  snapCommissionRate,
} from '../../types/leadTransfer';

type Props = {
  value: number;
  onChange: (value: number) => void;
  isDark?: boolean;
};

export default function CommissionRateSlider({ value, onChange, isDark = false }: Props) {
  const trackWidth = useRef(0);
  const safeValue = snapCommissionRate(Number.isFinite(value) ? value : COMMISSION_RATE_DEFAULT);
  const ratio =
    (safeValue - COMMISSION_RATE_MIN) / Math.max(COMMISSION_RATE_MAX - COMMISSION_RATE_MIN, COMMISSION_RATE_STEP);

  const colors = useMemo(
    () => ({
      track: isDark ? 'rgba(84,84,88,0.55)' : 'rgba(60,60,67,0.16)',
      fill: '#34C759',
      thumb: '#FFFFFF',
      text: isDark ? '#FFFFFF' : '#000000',
      muted: isDark ? '#8E8E93' : '#6C6C70',
    }),
    [isDark],
  );

  const setFromX = (x: number) => {
    if (trackWidth.current <= 0) return;
    const clamped = Math.max(0, Math.min(trackWidth.current, x));
    const next =
      COMMISSION_RATE_MIN +
      (clamped / trackWidth.current) * (COMMISSION_RATE_MAX - COMMISSION_RATE_MIN);
    onChange(snapCommissionRate(next));
  };

  const onLayout = (e: LayoutChangeEvent) => {
    trackWidth.current = e.nativeEvent.layout.width;
  };

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '700' }}>Prowizja agencji</Text>
        <Text style={{ color: colors.fill, fontSize: 18, fontWeight: '900' }}>
          {formatCommissionRate(safeValue)}
        </Text>
      </View>
      <Pressable
        onLayout={onLayout}
        onPress={(e) => setFromX(e.nativeEvent.locationX)}
        style={[styles.track, { backgroundColor: colors.track }]}
      >
        <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: colors.fill }]} />
        <View
          style={[
            styles.thumb,
            {
              left: `${ratio * 100}%`,
              backgroundColor: colors.thumb,
              borderColor: colors.fill,
            },
          ]}
        />
      </Pressable>
      <View style={styles.labelsRow}>
        <Text style={{ color: colors.muted, fontSize: 10, fontWeight: '600' }}>
          {formatCommissionRate(COMMISSION_RATE_MIN)}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 10, fontWeight: '600' }}>
          {formatCommissionRate(COMMISSION_RATE_MAX)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  track: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
  },
  thumb: {
    position: 'absolute',
    top: -6,
    width: 20,
    height: 20,
    marginLeft: -10,
    borderRadius: 10,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  labelsRow: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

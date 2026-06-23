import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  COMMISSION_RATE_DEFAULT,
  COMMISSION_RATE_MAX,
  COMMISSION_RATE_MIN,
  COMMISSION_RATE_STEP,
  commissionAmountFromRate,
  commissionAmountStep,
  commissionRateFromAmount,
  formatCommissionAmount,
  formatCommissionRate,
  snapCommissionAmount,
  snapCommissionRate,
} from '../../types/leadTransfer';

type CommissionMode = 'percent' | 'amount';

type Props = {
  value: number;
  onChange: (value: number) => void;
  offerPrice: number;
  isDark?: boolean;
};

export default function CommissionRateSlider({
  value,
  onChange,
  offerPrice,
  isDark = false,
}: Props) {
  const [mode, setMode] = useState<CommissionMode>('percent');
  const trackWidth = useRef(0);
  const safeRate = snapCommissionRate(Number.isFinite(value) ? value : COMMISSION_RATE_DEFAULT);
  const price = Number.isFinite(offerPrice) && offerPrice > 0 ? offerPrice : 0;
  const amount = commissionAmountFromRate(price, safeRate);
  const amountModeAvailable = price > 0;

  const colors = useMemo(
    () => ({
      track: isDark ? 'rgba(84,84,88,0.55)' : 'rgba(60,60,67,0.16)',
      fill: '#34C759',
      thumb: '#FFFFFF',
      text: isDark ? '#FFFFFF' : '#000000',
      muted: isDark ? '#8E8E93' : '#6C6C70',
      inputBg: isDark ? 'rgba(44,44,46,0.9)' : '#F2F2F7',
      border: isDark ? 'rgba(84,84,88,0.65)' : 'rgba(60,60,67,0.2)',
    }),
    [isDark],
  );

  const sliderValue =
    mode === 'percent' ? safeRate : snapCommissionAmount(price, amount);
  const sliderMin = mode === 'percent' ? COMMISSION_RATE_MIN : 0;
  const sliderMax = mode === 'percent' ? COMMISSION_RATE_MAX : price;
  const sliderRange = Math.max(sliderMax - sliderMin, COMMISSION_RATE_STEP);
  const ratio = (sliderValue - sliderMin) / sliderRange;

  const applyRawValue = useCallback(
    (raw: number) => {
      if (mode === 'percent') {
        onChange(snapCommissionRate(raw));
        return;
      }
      onChange(commissionRateFromAmount(price, snapCommissionAmount(price, raw)));
    },
    [mode, onChange, price],
  );

  const setFromX = useCallback(
    (x: number) => {
      if (trackWidth.current <= 0) return;
      const clamped = Math.max(0, Math.min(trackWidth.current, x));
      const next = sliderMin + (clamped / trackWidth.current) * sliderRange;
      applyRawValue(next);
    },
    [applyRawValue, sliderMin, sliderRange],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => setFromX(e.nativeEvent.locationX),
        onPanResponderMove: (e) => setFromX(e.nativeEvent.locationX),
      }),
    [setFromX],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    trackWidth.current = e.nativeEvent.layout.width;
  };

  const applyInputText = (text: string) => {
    const normalized = text.trim().replace(/\s/g, '').replace(',', '.');
    if (!normalized || normalized === '.') return;
    const parsed = parseFloat(normalized);
    if (!Number.isFinite(parsed)) return;
    applyRawValue(parsed);
  };

  const inputValue =
    mode === 'percent'
      ? safeRate.toFixed(1).replace('.', ',')
      : String(snapCommissionAmount(price, amount));

  const minLabel =
    mode === 'percent' ? formatCommissionRate(COMMISSION_RATE_MIN) : formatCommissionAmount(0);
  const maxLabel =
    mode === 'percent'
      ? formatCommissionRate(COMMISSION_RATE_MAX)
      : formatCommissionAmount(price);

  return (
    <View>
      <View style={styles.headerRow}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '700' }}>Prowizja agencji</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
            {formatCommissionRate(safeRate)}
            {amountModeAvailable ? ` · ${formatCommissionAmount(amount)}` : ''}
          </Text>
        </View>
        <View style={[styles.modeToggle, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
          <Pressable
            onPress={() => setMode('percent')}
            style={[styles.modeBtn, mode === 'percent' && styles.modeBtnActive]}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '800',
                color: mode === 'percent' ? '#FFFFFF' : colors.muted,
              }}
            >
              %
            </Text>
          </Pressable>
          <Pressable
            disabled={!amountModeAvailable}
            onPress={() => amountModeAvailable && setMode('amount')}
            style={[
              styles.modeBtn,
              mode === 'amount' && styles.modeBtnActive,
              !amountModeAvailable && { opacity: 0.4 },
            ]}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '800',
                color: mode === 'amount' ? '#FFFFFF' : colors.muted,
              }}
            >
              zł
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.inputRow}>
        <TextInput
          value={inputValue}
          onChangeText={applyInputText}
          keyboardType="decimal-pad"
          style={[
            styles.input,
            {
              color: colors.text,
              backgroundColor: colors.inputBg,
              borderColor: colors.border,
            },
          ]}
        />
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700' }}>
          {mode === 'percent' ? '%' : 'zł'}
        </Text>
      </View>

      <View
        style={styles.touchArea}
        onLayout={onLayout}
        {...panResponder.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel={
          mode === 'percent' ? 'Prowizja agencji w procentach' : 'Prowizja agencji w złotych'
        }
      >
        <View style={[styles.track, { backgroundColor: colors.track }]}>
          <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: colors.fill }]} />
        </View>
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
      </View>

      <View style={styles.labelsRow}>
        <Text style={{ color: colors.muted, fontSize: 10, fontWeight: '600' }}>{minLabel}</Text>
        <Text style={{ color: colors.muted, fontSize: 10, fontWeight: '600' }}>{maxLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modeToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    padding: 2,
  },
  modeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  modeBtnActive: {
    backgroundColor: '#34C759',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  input: {
    width: 110,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'right',
  },
  touchArea: {
    height: 44,
    justifyContent: 'center',
  },
  track: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
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
    top: '50%',
    width: 28,
    height: 28,
    marginTop: -14,
    marginLeft: -14,
    borderRadius: 14,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  labelsRow: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

type FocusField = 'percent' | 'amount' | null;

type Props = {
  value: number;
  onChange: (value: number) => void;
  offerPrice: number;
  isDark?: boolean;
};

function formatPercentDraft(rate: number): string {
  return rate.toFixed(1).replace('.', ',');
}

function formatAmountDraft(pln: number): string {
  return new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 }).format(pln);
}

function parseDecimalInput(text: string): number | null {
  const normalized = text.trim().replace(/\s/g, '').replace(',', '.');
  if (!normalized || normalized === '.') return null;
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function CommissionRateSlider({
  value,
  onChange,
  offerPrice,
  isDark = false,
}: Props) {
  const safeRate = snapCommissionRate(Number.isFinite(value) ? value : COMMISSION_RATE_DEFAULT);
  const price = Number.isFinite(offerPrice) && offerPrice > 0 ? offerPrice : 0;
  const amount = commissionAmountFromRate(price, safeRate);
  const amountStep = commissionAmountStep(price);

  const [activeField, setActiveField] = useState<FocusField>(null);
  const [percentDraft, setPercentDraft] = useState('');
  const [amountDraft, setAmountDraft] = useState('');
  const percentInputRef = useRef<TextInput>(null);
  const amountInputRef = useRef<TextInput>(null);

  const colors = useMemo(
    () => ({
      text: isDark ? '#FFFFFF' : '#000000',
      muted: isDark ? '#8E8E93' : '#6C6C70',
      subtle: isDark ? '#636366' : '#AEAEB2',
      card: isDark ? 'rgba(44,44,46,0.95)' : '#FFFFFF',
      cardBorder: isDark ? 'rgba(84,84,88,0.55)' : 'rgba(60,60,67,0.12)',
      inputBg: isDark ? 'rgba(28,28,30,0.9)' : '#F2F2F7',
      accent: '#34C759',
      stepper: isDark ? 'rgba(84,84,88,0.45)' : 'rgba(60,60,67,0.08)',
    }),
    [isDark],
  );

  useEffect(() => {
    if (activeField === 'percent') return;
    setPercentDraft(formatPercentDraft(safeRate));
  }, [safeRate, activeField]);

  useEffect(() => {
    if (activeField === 'amount') return;
    setAmountDraft(formatAmountDraft(amount));
  }, [amount, activeField]);

  const commitPercent = (text: string) => {
    const parsed = parseDecimalInput(text);
    if (parsed === null) {
      setPercentDraft(formatPercentDraft(safeRate));
      return;
    }
    onChange(snapCommissionRate(parsed));
  };

  const commitAmount = (text: string) => {
    if (price <= 0) return;
    const parsed = parseDecimalInput(text);
    if (parsed === null) {
      setAmountDraft(formatAmountDraft(amount));
      return;
    }
    onChange(commissionRateFromAmount(price, snapCommissionAmount(price, parsed)));
  };

  const stepPercent = (delta: number) => {
    percentInputRef.current?.blur();
    amountInputRef.current?.blur();
    setActiveField(null);
    onChange(snapCommissionRate(safeRate + delta));
  };

  const stepAmount = (delta: number) => {
    if (price <= 0) return;
    percentInputRef.current?.blur();
    amountInputRef.current?.blur();
    setActiveField(null);
    const next = snapCommissionAmount(price, amount + delta * amountStep);
    onChange(commissionRateFromAmount(price, next));
  };

  const percentAtMin = safeRate <= COMMISSION_RATE_MIN;
  const percentAtMax = safeRate >= COMMISSION_RATE_MAX;
  const amountAtMin = amount <= 0;
  const amountAtMax = price > 0 && amount >= price;

  const StepperButton = ({
    icon,
    onPress,
    disabled,
    accessibilityLabel,
  }: {
    icon: 'remove' | 'add';
    onPress: () => void;
    disabled?: boolean;
    accessibilityLabel: string;
  }) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.stepperBtn,
        { backgroundColor: colors.stepper },
        pressed && !disabled && { opacity: 0.7 },
        disabled && { opacity: 0.35 },
      ]}
    >
      <Ionicons name={icon} size={18} color={colors.text} />
    </Pressable>
  );

  return (
    <View style={styles.root}>
      <Text style={[styles.title, { color: colors.muted }]}>Prowizja agencji</Text>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        <View style={styles.row}>
          <View style={styles.rowLabel}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>Procent</Text>
            <Text style={[styles.rowHint, { color: colors.subtle }]}>
              {formatCommissionRate(COMMISSION_RATE_MIN)} – {formatCommissionRate(COMMISSION_RATE_MAX)}
            </Text>
          </View>
          <View style={styles.controls}>
            <StepperButton
              icon="remove"
              onPress={() => stepPercent(-COMMISSION_RATE_STEP)}
              disabled={percentAtMin}
              accessibilityLabel="Zmniejsz prowizję o 0,1 punktu procentowego"
            />
            <TextInput
              ref={percentInputRef}
              value={percentDraft}
              onFocus={() => setActiveField('percent')}
              onChangeText={setPercentDraft}
              onBlur={() => {
                commitPercent(percentDraft);
                setActiveField(null);
              }}
              onSubmitEditing={() => {
                commitPercent(percentDraft);
                percentInputRef.current?.blur();
              }}
              keyboardType="decimal-pad"
              returnKeyType="done"
              selectTextOnFocus
              style={[
                styles.input,
                {
                  color: colors.text,
                  backgroundColor: colors.inputBg,
                  borderColor: activeField === 'percent' ? colors.accent : 'transparent',
                },
              ]}
              accessibilityLabel="Prowizja w procentach"
            />
            <Text style={[styles.suffix, { color: colors.muted }]}>%</Text>
            <StepperButton
              icon="add"
              onPress={() => stepPercent(COMMISSION_RATE_STEP)}
              disabled={percentAtMax}
              accessibilityLabel="Zwiększ prowizję o 0,1 punktu procentowego"
            />
          </View>
        </View>

        {price > 0 ? (
          <>
            <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />
            <View style={styles.row}>
              <View style={styles.rowLabel}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>Wynagrodzenie</Text>
                <Text style={[styles.rowHint, { color: colors.subtle }]}>
                  Przy cenie {formatCommissionAmount(price)}
                </Text>
              </View>
              <View style={styles.controls}>
                <StepperButton
                  icon="remove"
                  onPress={() => stepAmount(-1)}
                  disabled={amountAtMin}
                  accessibilityLabel="Zmniejsz wynagrodzenie"
                />
                <TextInput
                  ref={amountInputRef}
                  value={amountDraft}
                  onFocus={() => setActiveField('amount')}
                  onChangeText={setAmountDraft}
                  onBlur={() => {
                    commitAmount(amountDraft);
                    setActiveField(null);
                  }}
                  onSubmitEditing={() => {
                    commitAmount(amountDraft);
                    amountInputRef.current?.blur();
                  }}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  selectTextOnFocus
                  style={[
                    styles.input,
                    styles.inputWide,
                    {
                      color: colors.text,
                      backgroundColor: colors.inputBg,
                      borderColor: activeField === 'amount' ? colors.accent : 'transparent',
                    },
                  ]}
                  accessibilityLabel="Wynagrodzenie w złotych"
                />
                <Text style={[styles.suffix, { color: colors.muted }]}>zł</Text>
                <StepperButton
                  icon="add"
                  onPress={() => stepAmount(1)}
                  disabled={amountAtMax}
                  accessibilityLabel="Zwiększ wynagrodzenie"
                />
              </View>
            </View>
          </>
        ) : null}
      </View>

      <Text style={[styles.summary, { color: colors.muted }]}>
        Propozycja: {formatCommissionRate(safeRate)}
        {price > 0 ? ` · ${formatCommissionAmount(amount)}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 8,
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 12,
  },
  row: {
    gap: 10,
  },
  rowLabel: {
    gap: 2,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  rowHint: {
    fontSize: 11,
    fontWeight: '500',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    minWidth: 72,
    flex: 1,
    maxWidth: 96,
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  inputWide: {
    maxWidth: 120,
  },
  suffix: {
    width: 18,
    fontSize: 13,
    fontWeight: '700',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  summary: {
    fontSize: 12,
    fontWeight: '600',
  },
});

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as Haptics from 'expo-haptics';
import type { AddOfferOption } from './AddOfferOptionField';
import AddOfferWheelPickerHint from './AddOfferWheelPickerHint';

type Props = {
  title: string;
  value: string;
  options: AddOfferOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  theme: { text: string; subtitle: string };
  cardBg: string;
  cardBorder: string;
  showScrollHint?: boolean;
  scrollHintLabel?: string;
};

/** Natywny bęben iOS — poza Animated/ScrollView hit-test; bez mode="dialog". */
export default function AddOfferWheelPickerColumn({
  title,
  value,
  options,
  onChange,
  disabled = false,
  theme,
  cardBg,
  cardBorder,
  showScrollHint = false,
  scrollHintLabel = '',
}: Props) {
  const [hintDismissed, setHintDismissed] = useState(false);

  useEffect(() => {
    if (showScrollHint) setHintDismissed(false);
  }, [showScrollHint]);

  const showHint = showScrollHint && !disabled && !hintDismissed;

  const dismissHint = useCallback(() => {
    setHintDismissed(true);
  }, []);

  return (
    <View style={styles.column}>
      <Text style={[styles.title, { color: theme.subtitle }]}>{title}</Text>
      <View
        style={[
          styles.box,
          {
            backgroundColor: cardBg,
            borderColor: cardBorder,
          },
          disabled && styles.boxDisabled,
        ]}
        pointerEvents={disabled ? 'none' : 'auto'}
        onStartShouldSetResponderCapture={() => {
          if (showHint) dismissHint();
          return false;
        }}
      >
        <AddOfferWheelPickerHint
          visible={showHint}
          label={scrollHintLabel}
          maskColor={cardBg}
        />
        <Picker
          selectedValue={value}
          onValueChange={(v) => {
            if (disabled) return;
            dismissHint();
            Haptics.selectionAsync();
            onChange(String(v ?? ''));
          }}
          enabled={!disabled}
          dropdownIconColor={theme.text}
          style={[styles.picker, { color: theme.text }]}
          itemStyle={{ color: theme.text, height: 160, fontSize: 18, fontWeight: '700' }}
          color={theme.subtitle}
        >
          {options.map((opt) => (
            <Picker.Item key={opt.value || '__empty__'} label={opt.label} value={opt.value} />
          ))}
        </Picker>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    flex: 1,
    alignItems: 'stretch',
  },
  title: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: 1,
  },
  box: {
    flex: 1,
    justifyContent: 'center',
    borderRadius: 24,
    borderWidth: 1,
    minHeight: Platform.OS === 'ios' ? 160 : 52,
    overflow: 'hidden',
  },
  boxDisabled: {
    opacity: 0.38,
  },
  picker: Platform.OS === 'ios'
    ? { width: '100%', height: 160 }
    : { width: '100%', height: 52, backgroundColor: 'transparent' },
});

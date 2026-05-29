import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as Haptics from 'expo-haptics';
import type { AddOfferOption } from './AddOfferOptionField';

type Props = {
  title: string;
  value: string;
  options: AddOfferOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  theme: { text: string; subtitle: string };
  cardBg: string;
  cardBorder: string;
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
}: Props) {
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
      >
        <Picker
          selectedValue={value}
          onValueChange={(v) => {
            if (disabled) return;
            Haptics.selectionAsync();
            onChange(String(v ?? ''));
          }}
          enabled={!disabled}
          dropdownIconColor={theme.text}
          style={[styles.picker, { color: theme.text }]}
          itemStyle={{ color: theme.text, height: 160, fontSize: 18, fontWeight: '700' }}
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

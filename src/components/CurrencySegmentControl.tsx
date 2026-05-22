import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { ListingCurrency } from '../money/types';

type Props = {
  value: ListingCurrency;
  onChange: (c: ListingCurrency) => void;
  isDark?: boolean;
};

export default function CurrencySegmentControl({ value, onChange, isDark }: Props) {
  const bg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const activeBg = '#007AFF';

  const pill = (code: ListingCurrency, label: string) => {
    const active = value === code;
    return (
      <Pressable
        onPress={() => {
          if (active) return;
          Haptics.selectionAsync();
          onChange(code);
        }}
        style={[styles.pill, { backgroundColor: active ? activeBg : 'transparent' }]}
      >
        <Text style={[styles.pillText, { color: active ? '#fff' : isDark ? '#fff' : '#1d1d1f' }]}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.row, { backgroundColor: bg }]}>
      {pill('PLN', 'PLN')}
      {pill('EUR', 'EUR')}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  pill: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 10,
  },
  pillText: { fontSize: 14, fontWeight: '800' },
});

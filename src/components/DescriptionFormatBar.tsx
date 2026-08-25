import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
type Kind = 'bullet' | 'check' | 'separator' | 'bold' | 'underline';

type Props = {
  isDark?: boolean;
  disabled?: boolean;
  onInsert: (kind: Kind) => void;
};

const ACTIONS: { kind: Kind; label: string }[] = [
  { kind: 'bold', label: 'B' },
  { kind: 'underline', label: 'U' },
  { kind: 'bullet', label: '•' },
  { kind: 'check', label: '✓' },
  { kind: 'separator', label: '—' },
];

export default function DescriptionFormatBar({ isDark, disabled, onInsert }: Props) {
  return (
    <View style={[styles.bar, isDark && { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.08)' }]}>
      {ACTIONS.map((item) => (
        <Pressable
          key={item.kind}
          disabled={disabled}
          onPress={() => onInsert(item.kind)}
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.55 }, disabled && { opacity: 0.35 }]}
        >
          <Text style={[styles.label, isDark && { color: '#f5f5f7' }]}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
    padding: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  btn: {
    minWidth: 36,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1d1d1f',
    letterSpacing: 0.4,
  },
});

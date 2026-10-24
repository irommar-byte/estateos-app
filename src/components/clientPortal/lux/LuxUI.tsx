import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LUX_SERIF, type LuxPalette } from './luxTheme';

export function LuxCard({ palette, children, style }: { palette: LuxPalette; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }, style]}>{children}</View>;
}

export function LuxKicker({ palette, children, color }: { palette: LuxPalette; children: React.ReactNode; color?: string }) {
  return <Text style={[styles.kicker, { color: color || palette.accent }]}>{String(children).toUpperCase()}</Text>;
}

export function LuxTitle({ palette, children, size = 22 }: { palette: LuxPalette; children: React.ReactNode; size?: number }) {
  return <Text style={{ fontFamily: LUX_SERIF, fontSize: size, color: palette.ink, marginTop: 4 }}>{children}</Text>;
}

export function LuxText({ palette, children, muted, style }: { palette: LuxPalette; children: React.ReactNode; muted?: boolean; style?: object }) {
  return <Text style={[{ fontSize: 14, lineHeight: 20, color: muted ? palette.muted : palette.ink }, style]}>{children}</Text>;
}

export function LuxButton({
  palette,
  label,
  onPress,
  variant = 'ink',
  busy,
  disabled,
  icon,
  style,
}: {
  palette: LuxPalette;
  label: string;
  onPress: () => void;
  variant?: 'ink' | 'primary' | 'ghost' | 'danger';
  busy?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const bg =
    variant === 'primary' ? palette.green : variant === 'ink' ? (palette.isDark ? palette.gold : palette.black) : variant === 'danger' ? palette.bad : 'transparent';
  const fg = variant === 'ghost' ? palette.ink : variant === 'ink' ? (palette.isDark ? palette.black : palette.gold) : '#FFFFFF';
  return (
    <Pressable
      onPress={() => {
        if (busy || disabled) return;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, borderColor: variant === 'ghost' ? palette.border : bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={fg} /> : icon}
      <Text style={[styles.btnText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function LuxChip({ palette, label, on, onPress, tone }: { palette: LuxPalette; label: string; on: boolean; onPress: () => void; tone?: string }) {
  const color = tone || palette.accent;
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={[styles.chip, { borderColor: on ? color : palette.border, backgroundColor: on ? `${color}22` : 'transparent' }]}
    >
      <Text style={{ fontSize: 13, fontWeight: '700', color: on ? color : palette.ink }}>{label}</Text>
    </Pressable>
  );
}

export function LuxField({
  palette,
  label,
  value,
  onChangeText,
  suffix,
  keyboardType,
  placeholder,
  multiline,
}: {
  palette: LuxPalette;
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  suffix?: string;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad' | 'phone-pad' | 'email-address';
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <View style={{ marginTop: 10 }}>
      {label ? <Text style={{ fontSize: 12, fontWeight: '700', color: palette.muted, marginBottom: 5 }}>{label}</Text> : null}
      <View style={[styles.field, { borderColor: palette.border, backgroundColor: palette.card, minHeight: multiline ? 80 : 48 }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor={palette.muted}
          multiline={multiline}
          autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
          style={{ flex: 1, fontSize: 16, fontWeight: '600', color: palette.ink, paddingVertical: 10, textAlignVertical: multiline ? 'top' : 'center' }}
        />
        {suffix ? <Text style={{ color: palette.muted, fontSize: 13 }}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, padding: 18, marginBottom: 14 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: 999,
    paddingHorizontal: 18,
    borderWidth: 1,
  },
  btnText: { fontSize: 15, fontWeight: '800' },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 },
  field: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, paddingHorizontal: 12 },
});

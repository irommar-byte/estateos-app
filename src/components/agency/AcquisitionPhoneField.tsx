import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CountryCode } from 'libphonenumber-js';
import PhoneCountryPickerModal from '../phone/PhoneCountryPickerModal';
import {
  buildE164FromNational,
  dialCodeFor,
  flagEmojiFromIso2,
  formatNationalAsYouType,
  getDeviceRegionCountry,
  parseStoredPhoneToLine,
} from '../../utils/phoneRegions';

export default function AcquisitionPhoneField({
  value,
  onChange,
  isDark,
  disabled,
  label = 'TELEFON',
}: {
  value: string;
  onChange: (e164OrDisplay: string) => void;
  isDark?: boolean;
  disabled?: boolean;
  label?: string;
}) {
  const parsed = parseStoredPhoneToLine(value, getDeviceRegionCountry());
  const [iso, setIso] = useState<CountryCode>(parsed.iso);
  const [national, setNational] = useState(() => formatNationalAsYouType(parsed.iso, parsed.nationalDigits));
  const [pickerOpen, setPickerOpen] = useState(false);

  const colors = {
    input: isDark ? '#2C2C2E' : '#F2F2F7',
    text: isDark ? '#FFFFFF' : '#000000',
    secondary: isDark ? '#8E8E93' : '#6C6C70',
    border: isDark ? 'rgba(84,84,88,0.45)' : 'rgba(60,60,67,0.12)',
    chip: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
  };

  useEffect(() => {
    const next = parseStoredPhoneToLine(value, iso);
    if (next.nationalDigits && next.iso !== iso) {
      setIso(next.iso);
      setNational(formatNationalAsYouType(next.iso, next.nationalDigits));
    }
  }, [value]);

  const emit = (nextIso: CountryCode, nextNational: string) => {
    const formatted = formatNationalAsYouType(nextIso, nextNational.replace(/\D/g, ''));
    setNational(formatted);
    const e164 = buildE164FromNational(nextIso, formatted);
    onChange(e164 || formatted);
  };

  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[styles.label, { color: colors.secondary }]}>{label}</Text>
      <View style={[styles.row, { backgroundColor: colors.input, borderColor: colors.border }]}>
        <Pressable
          disabled={disabled}
          onPress={() => setPickerOpen(true)}
          style={[styles.flagBtn, { backgroundColor: colors.chip }]}
        >
          <Text style={styles.flag}>{flagEmojiFromIso2(iso)}</Text>
          <Text style={[styles.dial, { color: colors.text }]}>+{dialCodeFor(iso)}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.secondary} />
        </Pressable>
        <TextInput
          editable={!disabled}
          value={national}
          keyboardType="phone-pad"
          placeholder="123 456 789"
          placeholderTextColor={colors.secondary}
          onChangeText={(text) => emit(iso, text)}
          style={[styles.input, { color: colors.text }]}
        />
      </View>
      <PhoneCountryPickerModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selectedIso={iso}
        isDark={isDark}
        onSelect={(next) => {
          setIso(next);
          emit(next, national);
          setPickerOpen(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingRight: 12,
  },
  flagBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    borderRadius: 10,
    paddingHorizontal: 8,
    marginLeft: 4,
    gap: 4,
  },
  flag: { fontSize: 20 },
  dial: { fontSize: 14, fontWeight: '800' },
  input: { flex: 1, fontSize: 16, paddingHorizontal: 10 },
});

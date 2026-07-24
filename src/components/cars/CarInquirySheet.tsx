import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { X } from 'lucide-react-native';
import type { CountryCode } from 'libphonenumber-js';
import { useAuthStore } from '../../store/useAuthStore';
import { PhoneCountryPickerPanel } from '../phone/PhoneCountryPickerModal';
import {
  buildE164FromNational,
  dialCodeFor,
  flagEmojiFromIso2,
  formatNationalAsYouType,
  getDeviceRegionCountry,
  parseStoredPhoneToLine,
} from '../../utils/phoneRegions';
import { submitCarInquiry } from '../../services/carsInquiry';
import { useCarScreenTheme, type CarScreenColors } from '../../theme/carScreenTheme';

const VIEWING_OPTIONS = [
  'Jak najszybciej',
  'W tym tygodniu',
  'W przyszłym tygodniu',
  'Tylko pytanie — bez oględzin',
] as const;

type CarInquirySheetProps = {
  visible: boolean;
  onClose: () => void;
  token: string;
  carId: number;
  carTitle: string;
  make: string;
  model: string;
  year: number;
  priceLabel: string;
  city: string;
  onSuccess: (threadId: number, peerUserId: number) => void;
};

export default function CarInquirySheet({
  visible,
  onClose,
  token,
  carId,
  carTitle,
  make,
  model,
  year,
  priceLabel,
  city,
  onSuccess,
}: CarInquirySheetProps) {
  const { colors, isDark } = useCarScreenTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const userPhone = useAuthStore((s) => s.user?.phone);
  const [viewingPreference, setViewingPreference] = useState<string>(VIEWING_OPTIONS[0]);
  const [countryIso, setCountryIso] = useState<CountryCode>('PL');
  const [nationalDigits, setNationalDigits] = useState('');
  const [nationalDisplay, setNationalDisplay] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [message, setMessage] = useState(
    `Dzień dobry, jestem zainteresowany/a ogłoszeniem „${carTitle}”. Proszę o informację o dostępności i możliwości oględzin.`,
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const line = parseStoredPhoneToLine(userPhone, getDeviceRegionCountry());
    setCountryIso(line.iso);
    setNationalDigits(line.nationalDigits);
    setNationalDisplay(formatNationalAsYouType(line.iso, line.nationalDigits));
  }, [visible, userPhone]);

  const handleNationalChange = (text: string) => {
    const d = text.replace(/\D/g, '');
    setNationalDigits(d);
    setNationalDisplay(formatNationalAsYouType(countryIso, d));
  };

  const handleSubmit = async () => {
    if (message.trim().length < 8) {
      Alert.alert('Wiadomość', 'Napisz co najmniej kilka słów do sprzedającego.');
      return;
    }
    const phoneE164 = buildE164FromNational(countryIso, nationalDigits);
    setSubmitting(true);
    try {
      const result = await submitCarInquiry(token, carId, {
        message,
        viewingPreference,
        phone: phoneE164 || undefined,
      });
      onClose();
      onSuccess(result.threadId, result.peerUserId);
    } catch (error) {
      Alert.alert('Błąd', error instanceof Error ? error.message : 'Nie udało się wysłać zapytania.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Text style={styles.title}>Zapytaj o auto</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X color={colors.muted} size={24} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.summary}>
            {make} {model} · {year} · {city}
          </Text>
          <Text style={styles.price}>{priceLabel}</Text>

          <Text style={styles.label}>Termin oględzin</Text>
          <View style={styles.chips}>
            {VIEWING_OPTIONS.map((option) => (
              <Pressable
                key={option}
                onPress={() => setViewingPreference(option)}
                style={[styles.chip, viewingPreference === option && styles.chipActive]}
              >
                <Text style={[styles.chipLabel, viewingPreference === option && styles.chipLabelActive]}>
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Telefon (opcjonalnie)</Text>
          <View style={styles.phoneRow}>
            <Pressable onPress={() => setPickerOpen(true)} style={styles.countryBtn}>
              <Text style={styles.countryFlag}>{flagEmojiFromIso2(countryIso)}</Text>
              <Text style={styles.countryDial}>+{dialCodeFor(countryIso)}</Text>
              <Ionicons name="chevron-down" size={16} color={colors.muted} />
            </Pressable>
            <TextInput
              value={nationalDisplay}
              onChangeText={handleNationalChange}
              placeholder={countryIso === 'PL' ? 'np. 500 600 700' : 'Numer krajowy'}
              placeholderTextColor={colors.placeholder}
              keyboardType="number-pad"
              style={[styles.input, styles.phoneInput]}
            />
          </View>

          <Text style={styles.label}>Twoja wiadomość</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            placeholderTextColor={colors.placeholder}
            style={[styles.input, styles.textarea]}
          />

          <Pressable onPress={handleSubmit} disabled={submitting} style={styles.submitBtn}>
            {submitting ? (
              <ActivityIndicator color={colors.primaryButtonText} />
            ) : (
              <Text style={styles.submitLabel}>Wyślij zapytanie</Text>
            )}
          </Pressable>
        </ScrollView>

        {pickerOpen ? (
          <View style={[StyleSheet.absoluteFill, { zIndex: 100 }]} pointerEvents="box-none">
            <Pressable
              style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
              onPress={() => setPickerOpen(false)}
            />
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 101 }}>
              <PhoneCountryPickerPanel
                selectedIso={countryIso}
                onSelect={(iso) => {
                  setCountryIso(iso);
                  setNationalDisplay(formatNationalAsYouType(iso, nationalDigits));
                }}
                onClose={() => setPickerOpen(false)}
                isDark={isDark}
              />
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(colors: CarScreenColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    header: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
      backgroundColor: colors.surface,
    },
    title: { color: colors.text, fontSize: 20, fontWeight: '700' },
    content: { padding: 20, paddingBottom: 40, gap: 10 },
    summary: { color: colors.muted, fontSize: 14 },
    price: { color: colors.accent, fontSize: 22, fontWeight: '800', marginBottom: 8 },
    label: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 6 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    chip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.chipBorder,
      backgroundColor: colors.chipBg,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    chipActive: {
      borderColor: colors.chipActiveBorder,
      backgroundColor: colors.chipActiveBg,
    },
    chipLabel: { color: colors.chipText, fontSize: 12 },
    chipLabelActive: { color: colors.chipActiveText, fontWeight: '700' },
    phoneRow: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
    countryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      backgroundColor: colors.inputBg,
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    countryFlag: { fontSize: 20, lineHeight: 24 },
    countryDial: { color: colors.text, fontSize: 15, fontWeight: '700' },
    input: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      backgroundColor: colors.inputBg,
      color: colors.text,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
    },
    phoneInput: { flex: 1 },
    textarea: { minHeight: 120 },
    submitBtn: {
      marginTop: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.primaryButtonBorder,
      backgroundColor: colors.primaryButtonBg,
      paddingVertical: 14,
      alignItems: 'center',
    },
    submitLabel: {
      color: colors.primaryButtonText,
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
    },
  });
}

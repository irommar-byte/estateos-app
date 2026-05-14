import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { isValidPhoneNumber, parsePhoneNumberFromString } from 'libphonenumber-js';
import type { CountryCode } from 'libphonenumber-js';
import { useAuthStore } from '../../store/useAuthStore';
import { API_URL } from '../../config/network';
import { PhoneCountryPickerPanel } from '../phone/PhoneCountryPickerModal';
import {
  buildE164FromNational,
  dialCodeFor,
  formatNationalAsYouType,
  getDeviceRegionCountry,
  parseStoredPhoneToLine,
  flagEmojiFromIso2,
} from '../../utils/phoneRegions';
import PhoneCountryPickerModal from '../phone/PhoneCountryPickerModal';

type Theme = { text: string; subtitle: string };

type Props = {
  visible: boolean;
  onClose: () => void;
  theme: Theme;
  isDark?: boolean;
};

export default function EditPhoneSheet({ visible, onClose, theme, isDark = false }: Props) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const updateProfileBasics = useAuthStore((s: any) => s.updateProfileBasics);
  const refreshUser = useAuthStore((s) => s.refreshUser);

  const [countryIso, setCountryIso] = useState<CountryCode>('PL');
  const [nationalDisplay, setNationalDisplay] = useState('');
  const [phoneCheck, setPhoneCheck] = useState<'idle' | 'loading' | 'available' | 'taken' | 'invalid' | 'same'>('idle');
  const [busySave, setBusySave] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const phoneVerified = Boolean(user?.isVerifiedPhone);

  const nationalDigits = nationalDisplay.replace(/\D/g, '');
  const draftE164 = buildE164FromNational(countryIso, nationalDigits);
  const draftValid = Boolean(draftE164 && isValidPhoneNumber(draftE164));

  useEffect(() => {
    if (!visible || !user) return;
    const dev = getDeviceRegionCountry();
    const line = parseStoredPhoneToLine(user.phone, dev);
    setCountryIso(line.iso);
    setNationalDisplay(formatNationalAsYouType(line.iso, line.nationalDigits));
    setPhoneCheck('idle');
  }, [visible, user?.id, user?.phone]);

  const currentUserE164 = (() => {
    const p = parsePhoneNumberFromString(String(user?.phone || '').trim());
    if (p?.isValid()) return p.number;
    const legacy = buildE164FromNational('PL', String(user?.phone || '').replace(/\D/g, '').slice(-9));
    return legacy && isValidPhoneNumber(legacy) ? legacy : null;
  })();

  useEffect(() => {
    if (!visible || phoneVerified) {
      setPhoneCheck('idle');
      return;
    }
    if (!nationalDigits) {
      setPhoneCheck('idle');
      return;
    }
    if (!draftE164 || !draftValid) {
      setPhoneCheck('invalid');
      return;
    }
    if (currentUserE164 && draftE164 === currentUserE164) {
      setPhoneCheck('same');
      return;
    }
    setPhoneCheck('loading');
    const ctrl = new AbortController();
    const display = parsePhoneNumberFromString(draftE164)?.formatInternational() || draftE164;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/check-exists`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: display, field: 'phone', value: display }),
          signal: ctrl.signal,
        });
        if (!res.ok) {
          setPhoneCheck('idle');
          return;
        }
        const d = await res.json().catch(() => ({} as any));
        if (d?.exists === true || d?.taken === true) {
          setPhoneCheck('taken');
        } else {
          setPhoneCheck('available');
        }
      } catch {
        setPhoneCheck('idle');
      }
    }, 500);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [visible, nationalDigits, draftE164, draftValid, phoneVerified, currentUserE164, countryIso]);

  const goSmsVerification = useCallback(() => {
    onClose();
    setTimeout(() => {
      try {
        navigation.navigate('SmsVerification');
      } catch {
        /* noop */
      }
    }, 280);
  }, [navigation, onClose]);

  const savePhoneIfNeeded = useCallback(async (): Promise<boolean> => {
    if (!user || phoneVerified) return true;
    if (!draftE164 || !draftValid) {
      Alert.alert('Telefon', 'Podaj prawidłowy numer dla wybranego kraju.');
      return false;
    }
    if (phoneCheck === 'taken') {
      Alert.alert('Numer zajęty', 'Ten numer jest już przypisany do innego konta.');
      return false;
    }
    if (currentUserE164 && draftE164 === currentUserE164) return true;

    setBusySave(true);
    try {
      const display = parsePhoneNumberFromString(draftE164)?.formatInternational() || draftE164;
      const r = await updateProfileBasics({ phone: display });
      if (!r?.ok) {
        Alert.alert('Nie udało się zapisać', r?.error || 'Spróbuj ponownie.');
        return false;
      }
      await refreshUser();
      return true;
    } finally {
      setBusySave(false);
    }
  }, [user, phoneVerified, draftE164, draftValid, phoneCheck, currentUserE164, updateProfileBasics, refreshUser]);

  const handleVerifySms = useCallback(async () => {
    if (phoneVerified) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!draftE164 || !draftValid) {
      Alert.alert('Telefon', 'Wybierz kraj i wpisz pełny numer zgodny z formatem.');
      return;
    }
    if (phoneCheck === 'taken') {
      Alert.alert('Numer zajęty', 'Wybierz inny numer lub skontaktuj się z pomocą.');
      return;
    }
    if (phoneCheck === 'loading') {
      Alert.alert('Chwila…', 'Trwa sprawdzanie dostępności numeru. Spróbuj za sekundę.');
      return;
    }
    const ok = await savePhoneIfNeeded();
    if (!ok) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    goSmsVerification();
  }, [phoneVerified, draftE164, draftValid, phoneCheck, savePhoneIfNeeded, goSmsVerification]);

  const handleNationalChange = (text: string) => {
    const d = text.replace(/\D/g, '');
    setNationalDisplay(formatNationalAsYouType(countryIso, d));
  };

  const surface = isDark ? 'rgba(28,28,30,0.94)' : 'rgba(255,255,255,0.97)';
  const textMain = isDark ? '#FFFFFF' : '#111827';
  const textMuted = isDark ? 'rgba(235,235,245,0.62)' : 'rgba(17,24,39,0.55)';
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(17,24,39,0.12)';
  const inputBg = isDark ? 'rgba(44,44,46,0.9)' : '#F2F2F7';

  const renderCheck = () => {
    if (phoneCheck === 'idle') return null;
    if (phoneCheck === 'loading') {
      return (
        <View style={styles.checkRow}>
          <ActivityIndicator size="small" color={String(textMuted)} />
          <Text style={[styles.checkText, { color: textMuted }]}>Sprawdzam dostępność…</Text>
        </View>
      );
    }
    if (phoneCheck === 'available') {
      return <Text style={styles.checkOk}>Numer dostępny — możesz go zapisać i zweryfikować SMS.</Text>;
    }
    if (phoneCheck === 'taken') {
      return <Text style={styles.checkErr}>Ten numer jest już używany.</Text>;
    }
    if (phoneCheck === 'invalid') {
      return <Text style={styles.checkWarn}>Dokończ numer zgodnie z formatem wybranego kraju.</Text>;
    }
    if (phoneCheck === 'same') {
      return <Text style={styles.checkWarn}>To jest Twój zapisany numer — możesz od razu zweryfikować SMS.</Text>;
    }
    return null;
  };

  if (phoneVerified) {
    return (
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <BlurView intensity={isDark ? 55 : 70} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          <View style={[styles.wrap, { paddingBottom: insets.bottom + 16 }]}>
            <View style={[styles.sheet, { backgroundColor: surface, borderColor: border }]}>
              <Text style={[styles.title, { color: textMain }]}>Telefon</Text>
              <Text style={[styles.sub, { color: textMuted }]}>
                Numer jest już potwierdzony SMS-em — edycja w aplikacji jest wyłączona.
              </Text>
              <Pressable onPress={onClose} style={styles.secondaryBtn}>
                <Text style={[styles.secondaryBtnText, { color: textMain }]}>Zamknij</Text>
              </Pressable>
            </View>
          </View>
        </BlurView>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <BlurView intensity={isDark ? 55 : 70} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={[styles.wrap, { paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 12) }]}
          >
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={[styles.sheet, { backgroundColor: surface, borderColor: border }]}>
                <View style={[styles.dragBar, { backgroundColor: isDark ? '#3A3A3C' : '#E5E7EB' }]} />
                <View style={styles.headerRow}>
                  <Text style={[styles.title, { color: textMain }]}>Numer telefonu</Text>
                  <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
                    <Ionicons name="close" size={22} color={String(textMuted)} />
                  </Pressable>
                </View>
                <Text style={[styles.sub, { color: textMuted }]}>
                  Wybierz kraj (flaga i nazwa), wpisz numer w lokalnym formacie. Po zapisie (jeśli zmieniasz numer) wyślemy kod SMS.
                </Text>

                <Text style={[styles.label, { color: textMuted }]}>Kraj</Text>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    setPickerOpen(true);
                  }}
                  style={[styles.countryRow, { backgroundColor: inputBg, borderColor: border }]}
                >
                  <Text style={styles.countryFlag}>{flagEmojiFromIso2(countryIso)}</Text>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.countryDial, { color: textMain }]}>+{dialCodeFor(countryIso)}</Text>
                  </View>
                  <Ionicons name="chevron-down" size={18} color={String(textMuted)} />
                </Pressable>

                <Text style={[styles.label, { color: textMuted }]}>Numer</Text>
                <TextInput
                  value={nationalDisplay}
                  onChangeText={handleNationalChange}
                  placeholder={countryIso === 'PL' ? 'np. 500 600 700' : 'Numer krajowy'}
                  placeholderTextColor={theme.subtitle}
                  keyboardType="number-pad"
                  style={[
                    styles.input,
                    {
                      color: theme.text,
                      backgroundColor: inputBg,
                      borderWidth: 1,
                      borderColor:
                        phoneCheck === 'taken'
                          ? 'rgba(200,52,28,0.6)'
                          : phoneCheck === 'available'
                            ? 'rgba(52,199,89,0.55)'
                            : border,
                    },
                  ]}
                />
                {renderCheck()}

                <Pressable
                  onPress={() => void handleVerifySms()}
                  disabled={busySave}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    { opacity: pressed ? 0.9 : busySave ? 0.65 : 1, backgroundColor: '#0A84FF' },
                  ]}
                >
                  {busySave ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Zweryfikuj SMS</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </BlurView>

        {pickerOpen ? (
          <View style={[StyleSheet.absoluteFill, { zIndex: 100 }]} pointerEvents="box-none">
            <Pressable
              style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
              onPress={() => setPickerOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Zamknij wybór kraju"
            />
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 101, elevation: 40 }} pointerEvents="box-none">
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  dragBar: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginTop: 8, marginBottom: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeBtn: { padding: 4 },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  sub: { fontSize: 13, lineHeight: 19, marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '700', marginTop: 8, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
  },
  countryFlag: { fontSize: 26, lineHeight: 30 },
  countryDial: { fontSize: 17, fontWeight: '800' },
  input: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  checkText: { fontSize: 12 },
  checkOk: { fontSize: 12, color: '#1f8a3a', fontWeight: '700', marginTop: 8 },
  checkErr: { fontSize: 12, color: '#c8341c', fontWeight: '700', marginTop: 8 },
  checkWarn: { fontSize: 12, color: '#b25b00', fontWeight: '700', marginTop: 8 },
  primaryBtn: { marginTop: 18, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  secondaryBtn: { marginTop: 16, paddingVertical: 12, alignItems: 'center' },
  secondaryBtnText: { fontSize: 16, fontWeight: '600' },
});

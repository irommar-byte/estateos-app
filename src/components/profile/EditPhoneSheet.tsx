import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { isValidPhoneNumber } from 'libphonenumber-js';
import type { CountryCode } from 'libphonenumber-js';
import { persistLocalPhoneVerified, useAuthStore } from '../../store/useAuthStore';
import { API_URL } from '../../config/network';
import { PhoneCountryPickerPanel } from '../phone/PhoneCountryPickerModal';
import {
  buildE164FromNational,
  dialCodeFor,
  formatNationalAsYouType,
  getDeviceRegionCountry,
  normalizePhoneE164,
  parseStoredPhoneToLine,
  flagEmojiFromIso2,
} from '../../utils/phoneRegions';

type Theme = { text: string; subtitle: string };

type Props = {
  visible: boolean;
  onClose: () => void;
  theme: Theme;
  isDark?: boolean;
};

const OTP_LEN = 6;
const AUTO_WAIT_SECONDS = 20;
const ESCALATION_SECONDS = 60;

export default function EditPhoneSheet({ visible, onClose, theme, isDark = false }: Props) {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const updateProfileBasics = useAuthStore((s: any) => s.updateProfileBasics);
  const refreshUser = useAuthStore((s) => s.refreshUser);

  const [countryIso, setCountryIso] = useState<CountryCode>('PL');
  const [nationalDisplay, setNationalDisplay] = useState('');
  const [phoneCheck, setPhoneCheck] = useState<'idle' | 'loading' | 'available' | 'taken' | 'invalid' | 'same'>('idle');
  const [busySave, setBusySave] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [verificationOpen, setVerificationOpen] = useState(false);
  const [autoWaitLeft, setAutoWaitLeft] = useState(0);
  const [manualUnlocked, setManualUnlocked] = useState(false);
  const [escalationLeft, setEscalationLeft] = useState(0);
  const [otp, setOtp] = useState<string[]>(() => Array(OTP_LEN).fill(''));
  const [busyVerify, setBusyVerify] = useState(false);
  const [busyAdmin, setBusyAdmin] = useState(false);
  const [otpError, setOtpError] = useState('');

  const phoneVerified = Boolean(user?.isVerifiedPhone);
  const nationalDigits = nationalDisplay.replace(/\D/g, '');
  const draftE164 = buildE164FromNational(countryIso, nationalDigits);
  const draftValid = Boolean(draftE164 && isValidPhoneNumber(draftE164));
  const currentUserE164 = normalizePhoneE164(user?.phone);

  useEffect(() => {
    if (!visible || !user?.id) return;
    const dev = getDeviceRegionCountry();
    const line = parseStoredPhoneToLine(user.phone, dev);
    setCountryIso(line.iso);
    setNationalDisplay(formatNationalAsYouType(line.iso, line.nationalDigits));
    setPhoneCheck('idle');
    setVerificationOpen(false);
    setAutoWaitLeft(0);
    setManualUnlocked(false);
    setEscalationLeft(0);
    setOtp(Array(OTP_LEN).fill(''));
    setBusyVerify(false);
    setBusyAdmin(false);
    setOtpError('');
  }, [visible, user?.id, user?.phone]);

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
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/check-exists`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: draftE164, field: 'phone', value: draftE164 }),
          signal: ctrl.signal,
        });
        if (!res.ok) {
          setPhoneCheck('idle');
          return;
        }
        const d = await res.json().catch(() => ({} as any));
        setPhoneCheck(d?.exists === true || d?.taken === true ? 'taken' : 'available');
      } catch {
        setPhoneCheck('idle');
      }
    }, 500);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [visible, phoneVerified, nationalDigits, draftE164, draftValid, currentUserE164]);

  useEffect(() => {
    if (!verificationOpen || manualUnlocked || autoWaitLeft <= 0) return;
    const timer = setInterval(() => {
      setAutoWaitLeft((prev) => {
        if (prev <= 1) {
          setManualUnlocked(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [verificationOpen, manualUnlocked, autoWaitLeft]);

  useEffect(() => {
    if (!verificationOpen || !manualUnlocked || escalationLeft <= 0) return;
    const timer = setInterval(() => setEscalationLeft((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [verificationOpen, manualUnlocked, escalationLeft]);

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
      const r = await updateProfileBasics({ phone: draftE164 });
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

  const sendSmsCode = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false;
    try {
      const res = await fetch(`${API_URL}/api/mobile/v1/auth/sms/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userId: user.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({} as any));
        Alert.alert('SMS', data?.message || 'Nie udało się wysłać kodu SMS.');
        return false;
      }
      return true;
    } catch {
      Alert.alert('SMS', 'Brak połączenia z serwerem.');
      return false;
    }
  }, [token, user?.id]);

  const verifyCode = useCallback(async (codeValue: string) => {
    if (!user?.id || busyVerify || codeValue.length !== OTP_LEN) return;
    setBusyVerify(true);
    setOtpError('');
    try {
      const res = await fetch(`${API_URL}/api/mobile/v1/auth/sms/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userId: user.id, code: codeValue }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (res.ok && data?.success) {
        await persistLocalPhoneVerified(user.id, true);
        await refreshUser();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Telefon potwierdzony', 'Numer został zweryfikowany SMS-em.');
        onClose();
        return;
      }
      setOtpError(data?.message || 'Nieprawidłowy kod.');
      setOtp(Array(OTP_LEN).fill(''));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch {
      setOtpError('Brak połączenia z serwerem.');
    } finally {
      setBusyVerify(false);
    }
  }, [busyVerify, onClose, refreshUser, token, user?.id]);

  useEffect(() => {
    if (!verificationOpen || busyVerify) return;
    const codeValue = otp.join('');
    if (otp.every((d) => d.length === 1) && codeValue.length === OTP_LEN) {
      void verifyCode(codeValue);
    }
  }, [otp, verificationOpen, busyVerify, verifyCode]);

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
    const sent = await sendSmsCode();
    if (!sent) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setVerificationOpen(true);
    setAutoWaitLeft(AUTO_WAIT_SECONDS);
    setManualUnlocked(false);
    setEscalationLeft(ESCALATION_SECONDS);
    setOtp(Array(OTP_LEN).fill(''));
    setOtpError('');
  }, [phoneVerified, draftE164, draftValid, phoneCheck, savePhoneIfNeeded, sendSmsCode]);

  const handleOtpChange = useCallback((index: number, text: string) => {
    if (!manualUnlocked || busyVerify) return;
    const digits = text.replace(/\D/g, '');
    if (!digits) {
      setOtp((prev) => {
        const next = [...prev];
        next[index] = '';
        return next;
      });
      return;
    }
    if (digits.length >= OTP_LEN) {
      setOtp(digits.slice(0, OTP_LEN).split(''));
      return;
    }
    setOtp((prev) => {
      const next = [...prev];
      next[index] = digits[0]!;
      return next;
    });
  }, [manualUnlocked, busyVerify]);

  const handleRequestAdminActivation = useCallback(async () => {
    if (!user?.id || busyAdmin) return;
    setBusyAdmin(true);
    try {
      const attempts = [
        `${API_URL}/api/mobile/v1/auth/verification/help-request`,
        `${API_URL}/api/mobile/v1/support/request-activation`,
        `${API_URL}/api/mobile/v1/admin/verification/request`,
      ];
      let sent = false;
      for (const url of attempts) {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ channel: 'sms', userId: user.id, phone: draftE164 }),
        }).catch(() => null as any);
        if (res?.ok) {
          sent = true;
          break;
        }
      }
      if (sent) {
        Alert.alert('Wysłano prośbę', 'Administrator otrzymał prośbę o aktywację telefonu.');
      } else {
        Alert.alert('Kontakt z administratorem', 'Nie udało się wysłać prośby automatycznie. Skontaktuj się z administratorem EstateOS.');
      }
    } finally {
      setBusyAdmin(false);
    }
  }, [busyAdmin, draftE164, token, user?.id]);

  const waitCountdownLabel = useMemo(() => {
    const m = Math.floor(escalationLeft / 60);
    const s = escalationLeft % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }, [escalationLeft]);

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
    if (phoneCheck === 'available') return <Text style={styles.checkOk}>Numer dostępny — możesz go zweryfikować SMS.</Text>;
    if (phoneCheck === 'taken') return <Text style={styles.checkErr}>Ten numer jest już używany.</Text>;
    if (phoneCheck === 'invalid') return <Text style={styles.checkWarn}>Dokończ numer zgodnie z formatem wybranego kraju.</Text>;
    if (phoneCheck === 'same') return <Text style={styles.checkWarn}>To jest Twój numer — możesz go od razu zweryfikować.</Text>;
    return null;
  };

  if (!visible) return null;

  if (phoneVerified) {
    return (
      <Modal visible animationType="slide" transparent onRequestClose={onClose}>
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
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
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
                  Kraj i numer są połączone w jednym polu. Po wysłaniu kodu czekamy 20 sekund na automatyczną aktywację.
                </Text>

                <Text style={[styles.label, { color: textMuted }]}>Numer telefonu</Text>
                <View
                  style={[
                    styles.phoneUnifiedRow,
                    {
                      backgroundColor: inputBg,
                      borderColor:
                        phoneCheck === 'taken'
                          ? 'rgba(200,52,28,0.6)'
                          : phoneCheck === 'available'
                            ? 'rgba(52,199,89,0.55)'
                            : border,
                    },
                  ]}
                >
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      setPickerOpen(true);
                    }}
                    style={styles.countryInlineBtn}
                  >
                    <Text style={styles.countryFlag}>{flagEmojiFromIso2(countryIso)}</Text>
                    <Text style={[styles.countryDial, { color: textMain }]}>+{dialCodeFor(countryIso)}</Text>
                    <Ionicons name="chevron-down" size={14} color={String(textMuted)} />
                  </Pressable>
                  <TextInput
                    value={nationalDisplay}
                    onChangeText={handleNationalChange}
                    placeholder={countryIso === 'PL' ? 'np. 500 600 700' : 'Numer krajowy'}
                    placeholderTextColor={theme.subtitle}
                    keyboardType="number-pad"
                    style={[styles.unifiedInput, { color: theme.text }]}
                  />
                </View>
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

                {verificationOpen ? (
                  <View style={[styles.otpPanel, { borderColor: border, backgroundColor: isDark ? 'rgba(44,44,46,0.6)' : 'rgba(247,247,250,0.95)' }]}>
                    <Text style={[styles.otpTitle, { color: textMain }]}>Kod z wiadomości SMS</Text>
                    <Text style={[styles.otpSub, { color: textMuted }]}>
                      {manualUnlocked
                        ? 'Wpisz kod ręcznie. Wklejanie jest zablokowane.'
                        : `Proszę czekać — próbujemy aktywować automatycznie (${autoWaitLeft}s).`}
                    </Text>
                    <View style={styles.otpRow}>
                      {otp.map((digit, idx) => (
                        <TextInput
                          key={`sms-otp-${idx}`}
                          value={digit}
                          onChangeText={(t) => handleOtpChange(idx, t)}
                          editable={manualUnlocked && !busyVerify}
                          contextMenuHidden
                          keyboardType="number-pad"
                          maxLength={idx === 0 ? OTP_LEN : 1}
                          textContentType="oneTimeCode"
                          autoComplete="sms-otp"
                          style={[
                            styles.otpBox,
                            {
                              color: textMain,
                              backgroundColor: manualUnlocked ? inputBg : (isDark ? 'rgba(58,58,60,0.55)' : '#ECECF1'),
                              borderColor: otpError ? 'rgba(200,52,28,0.7)' : border,
                            },
                          ]}
                        />
                      ))}
                    </View>
                    {busyVerify ? <ActivityIndicator style={{ marginTop: 10 }} color="#0A84FF" /> : null}
                    {otpError ? <Text style={styles.checkErr}>{otpError}</Text> : null}

                    {manualUnlocked ? (
                      <Pressable
                        onPress={() => {
                          if (escalationLeft > 0) return;
                          void handleRequestAdminActivation();
                        }}
                        disabled={busyAdmin || escalationLeft > 0}
                        style={({ pressed }) => [
                          styles.secondaryBtnFull,
                          { borderColor: border, opacity: pressed ? 0.9 : busyAdmin || escalationLeft > 0 ? 0.55 : 1 },
                        ]}
                      >
                        {busyAdmin ? (
                          <ActivityIndicator color={theme.text} />
                        ) : (
                          <Text style={[styles.secondaryBtnText, { color: textMain }]}>
                            {escalationLeft > 0
                              ? `Wyślij SMS ponownie za ${waitCountdownLabel}`
                              : 'Poproś administratora o aktywację'}
                          </Text>
                        )}
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
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
  phoneUnifiedRow: {
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  countryInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 10,
    marginRight: 8,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(120,120,128,0.35)',
  },
  countryFlag: { fontSize: 23, lineHeight: 30 },
  countryDial: { fontSize: 16, fontWeight: '800' },
  unifiedInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  checkText: { fontSize: 12 },
  checkOk: { fontSize: 12, color: '#1f8a3a', fontWeight: '700', marginTop: 8 },
  checkErr: { fontSize: 12, color: '#c8341c', fontWeight: '700', marginTop: 8 },
  checkWarn: { fontSize: 12, color: '#b25b00', fontWeight: '700', marginTop: 8 },
  primaryBtn: { marginTop: 18, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  secondaryBtn: { marginTop: 16, paddingVertical: 12, alignItems: 'center' },
  secondaryBtnText: { fontSize: 14, fontWeight: '700' },
  secondaryBtnFull: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpPanel: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  otpTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  otpSub: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  otpRow: { flexDirection: 'row', gap: 8, marginTop: 10, justifyContent: 'space-between' },
  otpBox: {
    flex: 1,
    maxWidth: 52,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
  },
});

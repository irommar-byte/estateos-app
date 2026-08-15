import React, { useCallback, useEffect, useState } from 'react';
import NumericKeyboardAccessory from '../NumericKeyboardAccessory';
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
import { useAuthStore } from '../../store/useAuthStore';
import { API_URL } from '../../config/network';

type Theme = { text: string; subtitle: string };

type Props = {
  visible: boolean;
  onClose: () => void;
  theme: Theme;
  isDark?: boolean;
  initialVerifyMode?: 'verify' | 'change';
};

const OTP_LEN = 6;
const AUTO_WAIT_SECONDS = 20;

export default function EditEmailSheet({
  visible,
  onClose,
  theme,
  isDark = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const sendCurrentEmailVerification = useAuthStore((s: any) => s.sendCurrentEmailVerification);
  const confirmCurrentEmailVerification = useAuthStore((s: any) => s.confirmCurrentEmailVerification);
  const refreshUser = useAuthStore((s) => s.refreshUser);

  const emailVerified = Boolean(user?.isEmailVerified);
  const currentEmail = String(user?.email || '').trim();

  const [otp, setOtp] = useState<string[]>(() => Array(OTP_LEN).fill(''));
  const [busySend, setBusySend] = useState(false);
  const [busyConfirm, setBusyConfirm] = useState(false);
  const [verificationStarted, setVerificationStarted] = useState(false);
  const [autoWaitLeft, setAutoWaitLeft] = useState(0);
  const [manualUnlocked, setManualUnlocked] = useState(false);
  const [otpError, setOtpError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setOtp(Array(OTP_LEN).fill(''));
    setBusySend(false);
    setBusyConfirm(false);
    setVerificationStarted(false);
    setAutoWaitLeft(0);
    setManualUnlocked(false);
    setOtpError('');
  }, [visible, user?.id]);

  useEffect(() => {
    if (!verificationStarted || manualUnlocked || autoWaitLeft <= 0) return;
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
  }, [verificationStarted, manualUnlocked, autoWaitLeft]);

  const confirmCode = useCallback(async (rawCode?: string) => {
    if (!verificationStarted || busyConfirm || emailVerified) return;
    const code = String(rawCode ?? otp.join('')).trim();
    if (code.length < OTP_LEN) {
      Alert.alert('Weryfikacja', 'Wpisz 6-cyfrowy kod z wiadomości.');
      return;
    }
    setBusyConfirm(true);
    setOtpError('');
    try {
      const r = await confirmCurrentEmailVerification(code);
      if (!r?.ok) {
        setOtpError(r?.error || 'Nieprawidłowy kod lub błąd serwera.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      await refreshUser();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('E-mail potwierdzony', 'Adres został zweryfikowany.');
      onClose();
    } finally {
      setBusyConfirm(false);
    }
  }, [verificationStarted, busyConfirm, emailVerified, otp, confirmCurrentEmailVerification, refreshUser, onClose]);

  useEffect(() => {
    if (!verificationStarted || busyConfirm) return;
    const code = otp.join('');
    if (otp.every((d) => d.length === 1) && code.length === OTP_LEN) {
      void confirmCode(code);
    }
  }, [verificationStarted, busyConfirm, otp, confirmCode]);

  const startVerification = useCallback(async () => {
    if (emailVerified) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBusySend(true);
    try {
      const r = (await sendCurrentEmailVerification()) as { ok: boolean; error?: string; alreadyVerified?: boolean };
      if (!r?.ok) {
        if (r?.alreadyVerified) {
          await refreshUser();
          Alert.alert('Adres potwierdzony', 'Twój e-mail jest już zweryfikowany.');
          return;
        }
        Alert.alert('Weryfikacja e-mail', r?.error || 'Nie udało się wysłać kodu.');
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setVerificationStarted(true);
      setAutoWaitLeft(AUTO_WAIT_SECONDS);
      setManualUnlocked(false);
      setOtp(Array(OTP_LEN).fill(''));
      setOtpError('');
    } finally {
      setBusySend(false);
    }
  }, [emailVerified, sendCurrentEmailVerification, refreshUser]);

  const handleOtpChange = useCallback((idx: number, text: string) => {
    if (!manualUnlocked || busyConfirm) return;
    const digits = text.replace(/\D/g, '');
    if (!digits) {
      setOtp((prev) => {
        const next = [...prev];
        next[idx] = '';
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
      next[idx] = digits[0]!;
      return next;
    });
  }, [manualUnlocked, busyConfirm]);

  const handleRequestAdminActivation = useCallback(async () => {
    if (!user?.id) return;
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
          body: JSON.stringify({ channel: 'email', userId: user.id, email: currentEmail }),
        }).catch(() => null as any);
        if (res?.ok) {
          sent = true;
          break;
        }
      }
      if (sent) {
        Alert.alert('Wysłano prośbę', 'Administrator otrzymał prośbę o aktywację e-maila.');
      } else {
        Alert.alert('Kontakt z administratorem', 'Nie udało się wysłać prośby automatycznie. Skontaktuj się z administratorem EstateOS.');
      }
    } catch {
      Alert.alert('Kontakt z administratorem', 'Wystąpił błąd podczas wysyłania prośby.');
    }
  }, [token, user?.id, currentEmail]);

  const surface = isDark ? 'rgba(28,28,30,0.94)' : 'rgba(255,255,255,0.97)';
  const textMain = isDark ? '#FFFFFF' : '#111827';
  const textMuted = isDark ? 'rgba(235,235,245,0.62)' : 'rgba(17,24,39,0.55)';
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(17,24,39,0.12)';
  const inputBg = isDark ? 'rgba(44,44,46,0.9)' : '#F2F2F7';
  const cardBg = isDark ? 'rgba(44,44,46,0.58)' : 'rgba(247,247,250,0.9)';

  if (!visible) return null;

  if (emailVerified) {
    return (
      <Modal visible animationType="slide" transparent onRequestClose={onClose}>
        <BlurView intensity={isDark ? 55 : 70} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          <View style={[styles.wrap, { paddingBottom: insets.bottom + 16 }]}>
            <View style={[styles.sheet, { backgroundColor: surface, borderColor: border }]}>
              <Text style={[styles.title, { color: textMain }]}>Adres e-mail</Text>
              <Text style={[styles.sub, { color: textMuted }]}>
                Adres <Text style={{ fontWeight: '800', color: textMain }}>{currentEmail}</Text> jest już potwierdzony.
              </Text>
              <Pressable onPress={onClose} style={styles.secondaryBtn}>
                <Text style={[styles.secondaryBtnText, { color: textMain }]}>Zamknij</Text>
              </Pressable>
            </View>
          </View>
        </BlurView>
      <NumericKeyboardAccessory />
    </Modal>
    );
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <BlurView intensity={isDark ? 55 : 70} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.wrap, { paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 12) }]}
        >
          <View style={[styles.sheet, { backgroundColor: surface, borderColor: border, maxHeight: '92%' }]}>
            <View style={[styles.dragBar, { backgroundColor: isDark ? '#3A3A3C' : '#E5E7EB' }]} />
            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: textMain }]}>Adres e-mail</Text>
              <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={String(textMuted)} />
              </Pressable>
            </View>
            <Text style={[styles.sub, { color: textMuted }]}>
              Potwierdzimy Twój adres maksymalnie automatycznie. Najpierw 20 sekund czekamy na kod bez udziału użytkownika.
            </Text>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
                <View style={styles.rowBetween}>
                  <View style={styles.rowLeft}>
                    <Ionicons name="mail-outline" size={18} color={String(textMuted)} />
                    <Text style={[styles.cardTitle, { color: textMain }]}>Twój e-mail</Text>
                  </View>
                  <View style={[styles.pillWarn, { borderColor: 'rgba(255,159,10,0.45)' }]}>
                    <Ionicons name="alert-circle" size={12} color="#b25b00" />
                    <Text style={styles.pillWarnText}>Niepotwierdzony</Text>
                  </View>
                </View>
                <Text style={[styles.cardSub, { color: textMuted }]}>
                  Obecny: <Text style={{ color: textMain, fontWeight: '700' }}>{currentEmail || '—'}</Text>
                </Text>

                {!verificationStarted ? (
                  <Pressable
                    onPress={() => void startVerification()}
                    disabled={busySend}
                    style={({ pressed }) => [
                      styles.secondaryBtnFull,
                      { borderColor: border, opacity: pressed ? 0.86 : busySend ? 0.6 : 1 },
                    ]}
                  >
                    {busySend ? (
                      <ActivityIndicator color={theme.text} />
                    ) : (
                      <Text style={[styles.secondaryBtnText, { color: textMain }]}>Potwierdź adres e-mail</Text>
                    )}
                  </Pressable>
                ) : null}

                {verificationStarted ? (
                  <>
                    <Text style={[styles.hint, { color: textMuted }]}>
                      {manualUnlocked
                        ? 'Kod nie został odczytany automatycznie. Wpisz 6 cyfr ręcznie.'
                        : `Proszę czekać — trwa automatyczna próba aktywacji (${autoWaitLeft}s).`}
                    </Text>
                    <View style={styles.otpRow}>
                      {otp.map((digit, idx) => (
                        <TextInput
                          key={`mail-otp-${idx}`}
                          value={digit}
                          onChangeText={(t) => handleOtpChange(idx, t)}
                          editable={manualUnlocked && !busyConfirm}
                          contextMenuHidden
                          placeholder={idx === 0 ? '•' : ''}
                          placeholderTextColor={theme.subtitle}
                          keyboardType="number-pad"
                          maxLength={idx === 0 ? OTP_LEN : 1}
                          textContentType="oneTimeCode"
                          autoComplete="one-time-code"
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
                    {otpError ? <Text style={styles.checkErr}>{otpError}</Text> : null}

                    {manualUnlocked ? (
                      <>
                        <Pressable
                          onPress={() => void confirmCode()}
                          disabled={busyConfirm}
                          style={({ pressed }) => [
                            styles.primaryBtn,
                            { opacity: pressed ? 0.9 : busyConfirm ? 0.65 : 1, backgroundColor: '#10b981' },
                          ]}
                        >
                          {busyConfirm ? (
                            <ActivityIndicator color="#fff" />
                          ) : (
                            <Text style={styles.primaryBtnText}>Sprawdź maila</Text>
                          )}
                        </Pressable>
                        <Pressable
                          onPress={() => void handleRequestAdminActivation()}
                          style={({ pressed }) => [
                            styles.secondaryBtnFull,
                            { borderColor: border, opacity: pressed ? 0.86 : 1 },
                          ]}
                        >
                          <Text style={[styles.secondaryBtnText, { color: textMain }]}>Poproś administratora o aktywację</Text>
                        </Pressable>
                      </>
                    ) : null}
                  </>
                ) : null}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </BlurView>
    <NumericKeyboardAccessory />
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
    paddingBottom: 10,
  },
  dragBar: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginTop: 8, marginBottom: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeBtn: { padding: 4 },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  sub: { fontSize: 13, lineHeight: 19, marginBottom: 8 },
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  cardSub: { fontSize: 12, lineHeight: 17, marginTop: 4, marginBottom: 4 },
  pillWarn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,159,10,0.16)',
  },
  pillWarnText: { color: '#b25b00', fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  hint: { fontSize: 12, lineHeight: 17, marginTop: 10 },
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
  checkErr: { fontSize: 12, lineHeight: 17, color: '#c8341c', fontWeight: '700', marginTop: 8 },
  secondaryBtnFull: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtn: { marginTop: 16, paddingVertical: 12, alignItems: 'center' },
  secondaryBtnText: { fontSize: 14, fontWeight: '700' },
  primaryBtn: { marginTop: 12, borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});

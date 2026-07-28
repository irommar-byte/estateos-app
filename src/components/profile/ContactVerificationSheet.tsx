import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
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
  parseStoredPhoneToLine,
  flagEmojiFromIso2,
} from '../../utils/phoneRegions';

type Theme = { text: string; subtitle: string };
type Props = { visible: boolean; onClose: () => void; theme: Theme; isDark?: boolean };
type Step = 'sms' | 'email' | 'done';

const OTP_LEN = 6;
const WAIT_SECONDS = 30;

function OtpRow({
  value,
  onChange,
  autoComplete,
  inputBg,
  textMain,
  border,
  autoFocus,
}: {
  value: string[];
  onChange: (idx: number, text: string) => void;
  autoComplete: 'sms-otp' | 'one-time-code';
  inputBg: string;
  textMain: string;
  border: string;
  autoFocus: boolean;
}) {
  const refs = useRef(Array.from({ length: OTP_LEN }, () => React.createRef<TextInput>())).current;
  return (
    <View style={styles.otpRow}>
      {value.map((digit, idx) => (
        <TextInput
          key={`${autoComplete}-${idx}`}
          ref={refs[idx]}
          value={digit}
          onChangeText={(t) => {
            const digits = t.replace(/\D/g, '');
            if (digits.length >= OTP_LEN) {
              onChange(0, digits.slice(0, OTP_LEN));
              refs[OTP_LEN - 1].current?.focus();
              return;
            }
            onChange(idx, digits);
            if (digits && idx < OTP_LEN - 1) refs[idx + 1].current?.focus();
          }}
          onKeyPress={({ nativeEvent }) => {
            if (nativeEvent.key === 'Backspace' && !digit && idx > 0) refs[idx - 1].current?.focus();
          }}
          keyboardType="number-pad"
          maxLength={idx === 0 ? OTP_LEN : 1}
          textContentType={idx === 0 ? 'oneTimeCode' : 'none'}
          autoComplete={idx === 0 ? autoComplete : 'off'}
          importantForAutofill={idx === 0 ? 'yes' : 'no'}
          autoFocus={idx === 0 && autoFocus}
          style={[
            styles.otpBox,
            { backgroundColor: inputBg, color: textMain, borderColor: border },
          ]}
        />
      ))}
    </View>
  );
}

export default function ContactVerificationSheet({ visible, onClose, theme, isDark = false }: Props) {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const updateProfileBasics = useAuthStore((s: any) => s.updateProfileBasics);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const sendCurrentEmailVerification = useAuthStore((s: any) => s.sendCurrentEmailVerification);
  const confirmCurrentEmailVerification = useAuthStore((s: any) => s.confirmCurrentEmailVerification);
  const requestProfileEmailChange = useAuthStore((s: any) => s.requestProfileEmailChange);
  const confirmProfileEmailChange = useAuthStore((s: any) => s.confirmProfileEmailChange);

  const phoneVerified = Boolean(user?.isVerifiedPhone);
  const emailVerified = Boolean(user?.isEmailVerified);
  const currentEmail = String(user?.email || '').trim();

  const [countryIso, setCountryIso] = useState<CountryCode>('PL');
  const [phoneInput, setPhoneInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);

  const [step, setStep] = useState<Step>('sms');
  const [waitLeft, setWaitLeft] = useState(WAIT_SECONDS);
  const [smsFallback, setSmsFallback] = useState(false);
  const [emailFallback, setEmailFallback] = useState(false);
  const [busy, setBusy] = useState(false);

  const [smsOtp, setSmsOtp] = useState<string[]>(() => Array(OTP_LEN).fill(''));
  const [emailOtp, setEmailOtp] = useState<string[]>(() => Array(OTP_LEN).fill(''));
  const [emailChangeFlow, setEmailChangeFlow] = useState(false);
  const [activeEmailTarget, setActiveEmailTarget] = useState('');
  const [smsError, setSmsError] = useState('');
  const [emailError, setEmailError] = useState('');

  const stepRef = useRef<Step>('sms');
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.trim().toLowerCase());
  const phoneDigits = phoneInput.replace(/\D/g, '');
  const phoneE164 = buildE164FromNational(countryIso, phoneDigits);
  const phoneValid = Boolean(phoneE164 && isValidPhoneNumber(phoneE164));
  const needsPhone = !phoneVerified;
  const needsEmail = !emailVerified;

  const surface = isDark ? 'rgba(28,28,30,0.96)' : 'rgba(255,255,255,0.98)';
  const textMain = isDark ? '#FFFFFF' : '#111827';
  const textMuted = isDark ? 'rgba(235,235,245,0.62)' : 'rgba(17,24,39,0.55)';
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(17,24,39,0.12)';
  const inputBg = isDark ? 'rgba(44,44,46,0.9)' : '#F2F2F7';

  const progress = useMemo(() => Math.max(0, Math.min(1, waitLeft / WAIT_SECONDS)), [waitLeft]);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    if (!visible || !user?.id) return;
    const dev = getDeviceRegionCountry();
    const line = parseStoredPhoneToLine(user.phone, dev);
    setCountryIso(line.iso);
    setPhoneInput(formatNationalAsYouType(line.iso, line.nationalDigits));
    setEmailInput(String(user.email || '').trim());
    setSmsOtp(Array(OTP_LEN).fill(''));
    setEmailOtp(Array(OTP_LEN).fill(''));
    setSmsFallback(false);
    setEmailFallback(false);
    setSmsError('');
    setEmailError('');
    setStep(needsPhone ? 'sms' : needsEmail ? 'email' : 'done');
    setWaitLeft(WAIT_SECONDS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, user?.id]); // intentionally only on open

  useEffect(() => {
    if (!visible || step === 'done') return;
    setWaitLeft(WAIT_SECONDS);
    const t = setInterval(() => {
      setWaitLeft((prev) => {
        if (prev <= 1) {
          if (stepRef.current === 'sms') setSmsFallback(true);
          if (stepRef.current === 'email') setEmailFallback(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [step, visible]);

  const setOtpValue = (setter: React.Dispatch<React.SetStateAction<string[]>>, idx: number, input: string) => {
    const digits = input.replace(/\D/g, '');
    if (idx === 0 && digits.length >= OTP_LEN) {
      setter(digits.slice(0, OTP_LEN).split(''));
      return;
    }
    setter((prev) => {
      const next = [...prev];
      next[idx] = digits.slice(0, 1);
      return next;
    });
  };

  const verifySmsCode = useCallback(async (code: string) => {
    if (!user?.id || code.length !== OTP_LEN || busy) return;
    setBusy(true);
    setSmsError('');
    try {
      const res = await fetch(`${API_URL}/api/mobile/v1/auth/sms/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ userId: user.id, code }),
      });
      const data = await res.json().catch(() => ({} as any));
      if (!(res.ok && data?.success)) {
        setSmsError(data?.message || 'Nieprawidłowy kod SMS.');
        return;
      }
      await persistLocalPhoneVerified(user.id, true);
      await refreshUser();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (needsEmail) {
        setStep('email');
      } else {
        setStep('done');
      }
    } finally {
      setBusy(false);
    }
  }, [user?.id, busy, token, refreshUser, needsEmail]);

  const verifyEmailCode = useCallback(async (code: string) => {
    if (code.length !== OTP_LEN || busy) return;
    setBusy(true);
    setEmailError('');
    try {
      const target = activeEmailTarget || emailInput.trim().toLowerCase();
      const res = emailChangeFlow
        ? await confirmProfileEmailChange(target, code)
        : await confirmCurrentEmailVerification(code);
      if (!res?.ok) {
        setEmailError(res?.error || 'Nieprawidłowy kod e-mail.');
        return;
      }
      await refreshUser();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep('done');
      onClose();
    } finally {
      setBusy(false);
    }
  }, [busy, activeEmailTarget, emailInput, emailChangeFlow, confirmProfileEmailChange, confirmCurrentEmailVerification, refreshUser, onClose]);

  useEffect(() => {
    if (step !== 'sms' || busy) return;
    const code = smsOtp.join('');
    if (smsOtp.every((d) => d.length === 1) && code.length === OTP_LEN) void verifySmsCode(code);
  }, [smsOtp, step, busy, verifySmsCode]);

  useEffect(() => {
    if (step !== 'email' || busy) return;
    const code = emailOtp.join('');
    if (emailOtp.every((d) => d.length === 1) && code.length === OTP_LEN) void verifyEmailCode(code);
  }, [emailOtp, step, busy, verifyEmailCode]);

  const startSms = useCallback(async () => {
    if (!needsPhone || !user?.id || !phoneValid || !phoneE164) return;
    setBusy(true);
    try {
      await updateProfileBasics({ phone: phoneE164 });
      await refreshUser();
      await fetch(`${API_URL}/api/mobile/v1/auth/sms/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ userId: user.id }),
      }).catch(() => null);
      setSmsFallback(false);
      setSmsOtp(Array(OTP_LEN).fill(''));
      setWaitLeft(WAIT_SECONDS);
    } finally {
      setBusy(false);
    }
  }, [needsPhone, user?.id, phoneValid, phoneE164, updateProfileBasics, refreshUser, token]);

  const startEmail = useCallback(async () => {
    if (!needsEmail || !emailLooksValid) return;
    setBusy(true);
    try {
      const target = emailInput.trim().toLowerCase();
      const isChange = target !== currentEmail.toLowerCase();
      setActiveEmailTarget(target);
      if (isChange) {
        setEmailChangeFlow(true);
        await requestProfileEmailChange(target);
      } else {
        setEmailChangeFlow(false);
        await sendCurrentEmailVerification();
      }
      setEmailFallback(false);
      setEmailOtp(Array(OTP_LEN).fill(''));
      setWaitLeft(WAIT_SECONDS);
    } finally {
      setBusy(false);
    }
  }, [needsEmail, emailLooksValid, emailInput, currentEmail, requestProfileEmailChange, sendCurrentEmailVerification]);

  useEffect(() => {
    if (!visible) return;
    if (step === 'sms' && needsPhone) void startSms();
    if (step === 'email' && needsEmail) void startEmail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, step]); // intentionally one-shot per step

  const requestAdmin = useCallback(async () => {
    const phone = phoneE164 || String(user?.phone || '');
    const email = (activeEmailTarget || emailInput || currentEmail).trim();
    const subject = encodeURIComponent('Prośba o ręczną aktywację kontaktu');
    const body = encodeURIComponent(
      `Proszę o ręczną aktywację kontaktu.\n\nUżytkownik ID: ${String(user?.id || '')}\nTelefon: ${phone}\nE-mail: ${email}\nKrok: ${step === 'sms' ? 'SMS' : 'E-mail'}\n`
    );
    try {
      await Linking.openURL(`mailto:kontakt@estateos.pl?subject=${subject}&body=${body}`);
    } catch {
      Alert.alert('Administrator', 'Nie udało się otworzyć aplikacji Mail.');
    }
  }, [phoneE164, user?.phone, user?.id, activeEmailTarget, emailInput, currentEmail, step]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <BlurView intensity={isDark ? 55 : 70} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={[styles.wrap, { paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 12) }]}
          >
            <View style={[styles.sheet, { backgroundColor: surface, borderColor: border }]}>
              <View style={[styles.dragBar, { backgroundColor: isDark ? '#3A3A3C' : '#E5E7EB' }]} />
              <View style={styles.headerRow}>
                <Text style={[styles.title, { color: textMain }]}>Potwierdź kontakt</Text>
                <Pressable onPress={onClose} hitSlop={12}>
                  <Ionicons name="close" size={22} color={String(textMuted)} />
                </Pressable>
              </View>

              {step !== 'done' ? (
                <View style={[styles.waitBanner, { borderColor: border }]}>
                  <Text style={[styles.waitTitle, { color: textMain }]}>
                    {step === 'sms' ? 'Krok 1/2 — SMS' : 'Krok 2/2 — E-mail'}
                  </Text>
                  <Text style={[styles.waitSub, { color: textMuted }]}>
                    Czekamy na podpowiedź kodu przez {WAIT_SECONDS}s. Kursor jest ustawiony na pierwszym polu.
                  </Text>
                  <View style={[styles.progressTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,39,0.08)' }]}>
                    <View style={[styles.progressFill, { width: `${Math.max(4, progress * 100)}%` }]} />
                  </View>
                  <Text style={styles.waitTimer}>{waitLeft}s</Text>
                </View>
              ) : null}

              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 14 }}>
                {step === 'sms' ? (
                  <View style={[styles.card, { borderColor: border }]}>
                    <Text style={[styles.cardTitle, { color: textMain }]}>Telefon</Text>
                    <View style={[styles.phoneRow, { borderColor: border, backgroundColor: inputBg }]}>
                      <Pressable onPress={() => setPickerOpen(true)} style={styles.countryBtn}>
                        <Text style={styles.countryFlag}>{flagEmojiFromIso2(countryIso)}</Text>
                        <Text style={[styles.countryDial, { color: textMain }]}>+{dialCodeFor(countryIso)}</Text>
                        <Ionicons name="chevron-down" size={14} color={String(textMuted)} />
                      </Pressable>
                      <TextInput
                        value={phoneInput}
                        onChangeText={(t) => setPhoneInput(formatNationalAsYouType(countryIso, t.replace(/\D/g, '')))}
                        placeholder="Numer telefonu"
                        placeholderTextColor={theme.subtitle}
                        keyboardType="number-pad"
                        style={[styles.phoneInput, { color: theme.text }]}
                      />
                    </View>
                    <Text style={[styles.hint, { color: textMuted }]}>
                      {phoneValid ? 'Czekamy na kod SMS — możesz też wpisać ręcznie.' : 'Wpisz poprawny numer telefonu.'}
                    </Text>
                    <OtpRow
                      value={smsOtp}
                      onChange={(idx, t) => setOtpValue(setSmsOtp, idx, t)}
                      autoComplete="sms-otp"
                      inputBg={inputBg}
                      textMain={textMain}
                      border={border}
                      autoFocus={true}
                    />
                    {smsError ? <Text style={styles.err}>{smsError}</Text> : null}
                    {smsFallback ? (
                      <Pressable style={[styles.secondaryBtn, { borderColor: border }]} onPress={() => void requestAdmin()}>
                        <Text style={[styles.secondaryBtnText, { color: textMain }]}>Poproś administratora o aktywację</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}

                {step === 'email' ? (
                  <View style={[styles.card, { borderColor: border }]}>
                    <Text style={[styles.cardTitle, { color: textMain }]}>E-mail</Text>
                    <TextInput
                      value={emailInput}
                      onChangeText={setEmailInput}
                      placeholder="Adres e-mail"
                      placeholderTextColor={theme.subtitle}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      style={[styles.emailInput, { color: theme.text, backgroundColor: inputBg, borderColor: border }]}
                    />
                    <Text style={[styles.hint, { color: textMuted }]}>
                      Kod na: {activeEmailTarget || emailInput || currentEmail}
                    </Text>
                    <OtpRow
                      value={emailOtp}
                      onChange={(idx, t) => setOtpValue(setEmailOtp, idx, t)}
                      autoComplete="one-time-code"
                      inputBg={inputBg}
                      textMain={textMain}
                      border={border}
                      autoFocus={true}
                    />
                    {emailError ? <Text style={styles.err}>{emailError}</Text> : null}
                    {emailFallback ? (
                      <>
                        <Pressable style={styles.primaryBtn} onPress={() => void Linking.openURL('message://').catch(() => Linking.openURL(`mailto:${encodeURIComponent(activeEmailTarget || emailInput || currentEmail)}`))}>
                          <Text style={styles.primaryBtnText}>Sprawdź maila</Text>
                        </Pressable>
                        <Pressable style={[styles.secondaryBtn, { borderColor: border }]} onPress={() => void requestAdmin()}>
                          <Text style={[styles.secondaryBtnText, { color: textMain }]}>Poproś administratora o aktywację</Text>
                        </Pressable>
                      </>
                    ) : null}
                  </View>
                ) : null}

                {step === 'done' ? (
                  <View style={[styles.card, { borderColor: border }]}>
                    <Text style={[styles.cardTitle, { color: textMain }]}>Gotowe</Text>
                    <Text style={[styles.hint, { color: textMuted }]}>Telefon i e-mail są aktywowane.</Text>
                    <Pressable style={styles.primaryBtn} onPress={onClose}>
                      <Text style={styles.primaryBtnText}>Zamknij</Text>
                    </Pressable>
                  </View>
                ) : null}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </BlurView>

        {pickerOpen ? (
          <View style={[StyleSheet.absoluteFill, { zIndex: 100 }]} pointerEvents="box-none">
            <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]} onPress={() => setPickerOpen(false)} />
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 101, elevation: 40 }}>
              <PhoneCountryPickerPanel
                selectedIso={countryIso}
                onSelect={(iso) => {
                  setCountryIso(iso);
                  setPhoneInput(formatNationalAsYouType(iso, phoneDigits));
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
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, paddingHorizontal: 16, paddingBottom: 8, maxHeight: '94%' },
  dragBar: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginTop: 8, marginBottom: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 21, fontWeight: '800', letterSpacing: -0.35 },
  waitBanner: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, marginTop: 8, marginBottom: 10 },
  waitTitle: { fontSize: 15, fontWeight: '800' },
  waitSub: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  waitTimer: { marginTop: 6, fontSize: 13, fontWeight: '800', color: '#0A84FF', alignSelf: 'flex-end' },
  progressTrack: { height: 4, borderRadius: 999, marginTop: 10, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: '#0A84FF' },
  card: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 10 },
  cardTitle: { fontSize: 17, fontWeight: '800', marginBottom: 8 },
  phoneRow: { borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  countryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 10, marginRight: 8, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: 'rgba(120,120,128,0.35)' },
  countryFlag: { fontSize: 20 },
  countryDial: { fontSize: 15, fontWeight: '800' },
  phoneInput: { flex: 1, fontSize: 16, paddingVertical: Platform.OS === 'ios' ? 12 : 10 },
  emailInput: { borderWidth: 1, borderRadius: 12, fontSize: 16, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 12 : 10 },
  hint: { fontSize: 12, lineHeight: 17, marginTop: 8, marginBottom: 8 },
  otpRow: { flexDirection: 'row', gap: 8, marginTop: 2, justifyContent: 'space-between' },
  otpBox: { flex: 1, maxWidth: 52, minHeight: 48, borderRadius: 10, borderWidth: 1, textAlign: 'center', fontSize: 18, fontWeight: '800' },
  err: { color: '#c8341c', fontSize: 12, fontWeight: '700', marginTop: 8 },
  primaryBtn: { marginTop: 12, borderRadius: 13, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#10b981' },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  secondaryBtn: { marginTop: 10, borderRadius: 12, borderWidth: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { fontSize: 14, fontWeight: '700' },
});

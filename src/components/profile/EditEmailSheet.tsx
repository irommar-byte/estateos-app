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
import { useAuthStore } from '../../store/useAuthStore';
import { API_URL } from '../../config/network';

type Theme = { text: string; subtitle: string };

type Props = {
  visible: boolean;
  onClose: () => void;
  theme: Theme;
  isDark?: boolean;
  /** Gdy jest oczekujący nowy adres — od razu sekcja zmiany + kod. */
  initialVerifyMode?: 'verify' | 'change';
};

type CheckState = 'idle' | 'loading' | 'available' | 'taken' | 'invalid' | 'same';

export default function EditEmailSheet({
  visible,
  onClose,
  theme,
  isDark = false,
  initialVerifyMode = 'verify',
}: Props) {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const requestProfileEmailChange = useAuthStore((s: any) => s.requestProfileEmailChange);
  const confirmProfileEmailChange = useAuthStore((s: any) => s.confirmProfileEmailChange);
  const sendCurrentEmailVerification = useAuthStore((s: any) => s.sendCurrentEmailVerification);
  const confirmCurrentEmailVerification = useAuthStore((s: any) => s.confirmCurrentEmailVerification);
  const refreshUser = useAuthStore((s) => s.refreshUser);

  const [newEmail, setNewEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [emailCheck, setEmailCheck] = useState<CheckState>('idle');
  const [busyEmailSend, setBusyEmailSend] = useState(false);
  const [busyEmailConfirm, setBusyEmailConfirm] = useState(false);
  const [busyCurrentSend, setBusyCurrentSend] = useState(false);
  const [busyCurrentConfirm, setBusyCurrentConfirm] = useState(false);
  const [currentEmailCode, setCurrentEmailCode] = useState('');
  const [verifyMode, setVerifyMode] = useState<'verify' | 'change'>('verify');

  const emailVerified = Boolean(user?.isEmailVerified);
  const currentEmail = String(user?.email || '').trim();
  const pendingEmail = String(user?.pendingEmail || '').trim();
  const hasPendingEmail = pendingEmail.length > 0 && pendingEmail.toLowerCase() !== currentEmail.toLowerCase();
  const emailBlocking =
    emailCheck === 'taken' ||
    emailCheck === 'invalid' ||
    emailCheck === 'loading' ||
    emailCheck === 'same' ||
    emailCheck === 'idle';

  useEffect(() => {
    if (!visible || !user) return;
    const pend = String(user.pendingEmail || '').trim();
    setNewEmail(
      pend && pend.toLowerCase() !== String(user.email || '').trim().toLowerCase() ? pend : ''
    );
    setEmailCode('');
    setCurrentEmailCode('');
    setVerifyMode(initialVerifyMode);
  }, [visible, user?.id, initialVerifyMode]);

  useEffect(() => {
    if (!visible) {
      setEmailCheck('idle');
      return;
    }
    const v = String(newEmail || '').trim().toLowerCase();
    if (!v) {
      setEmailCheck('idle');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      setEmailCheck('invalid');
      return;
    }
    if (v === currentEmail.toLowerCase()) {
      setEmailCheck('same');
      return;
    }
    setEmailCheck('loading');
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/check-exists`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: v, field: 'email', value: v }),
          signal: ctrl.signal,
        });
        if (!res.ok) {
          setEmailCheck('idle');
          return;
        }
        const d = await res.json().catch(() => ({} as any));
        if (d?.exists === true || d?.taken === true) {
          setEmailCheck('taken');
        } else {
          setEmailCheck('available');
        }
      } catch {
        setEmailCheck('idle');
      }
    }, 500);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [visible, newEmail, currentEmail]);

  const sendEmailCode = useCallback(async () => {
    if (emailVerified) return;
    const em = String(newEmail || '').trim().toLowerCase();
    if (!em.includes('@')) {
      Alert.alert('E-mail', 'Podaj poprawny nowy adres e-mail.');
      return;
    }
    if (em === currentEmail.toLowerCase()) {
      Alert.alert('E-mail', 'Nowy adres musi być inny niż obecny.');
      return;
    }
    Haptics.selectionAsync();
    setBusyEmailSend(true);
    try {
      const r = await requestProfileEmailChange(em);
      if (!r?.ok) {
        Alert.alert('Weryfikacja e-mail', r?.error || 'Nie udało się wysłać kodu.');
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Kod wysłany',
        'Na nowy adres e-mail wysłano wiadomość z kodem. Wpisz kod poniżej i potwierdź.',
      );
    } finally {
      setBusyEmailSend(false);
    }
  }, [newEmail, currentEmail, requestProfileEmailChange, emailVerified]);

  const confirmEmail = useCallback(async () => {
    if (emailVerified) return;
    const em = String(newEmail || '').trim().toLowerCase();
    const code = String(emailCode || '').trim();
    if (!em.includes('@') || code.length < 4) {
      Alert.alert('Weryfikacja', 'Podaj nowy e-mail i kod z wiadomości.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBusyEmailConfirm(true);
    try {
      const r = await confirmProfileEmailChange(em, code);
      if (!r?.ok) {
        Alert.alert('Weryfikacja e-mail', r?.error || 'Nieprawidłowy kod lub błąd serwera.');
        return;
      }
      await refreshUser();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('E-mail zmieniony', 'Adres został zaktualizowany po pomyślnej weryfikacji.');
      setNewEmail('');
      setEmailCode('');
      onClose();
    } finally {
      setBusyEmailConfirm(false);
    }
  }, [newEmail, emailCode, confirmProfileEmailChange, refreshUser, onClose, emailVerified]);

  const sendCurrentCode = useCallback(async () => {
    if (emailVerified) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBusyCurrentSend(true);
    try {
      const r = (await sendCurrentEmailVerification()) as { ok: boolean; error?: string; alreadyVerified?: boolean };
      if (!r?.ok) {
        if (r?.alreadyVerified) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert('Adres potwierdzony', 'Twój e-mail jest już zweryfikowany.');
          return;
        }
        Alert.alert('Weryfikacja e-mail', r?.error || 'Nie udało się wysłać kodu.');
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Kod wysłany', `Wysłaliśmy 6-cyfrowy kod na ${currentEmail}. Sprawdź skrzynkę (także spam).`);
    } finally {
      setBusyCurrentSend(false);
    }
  }, [emailVerified, sendCurrentEmailVerification, currentEmail]);

  const confirmCurrentCode = useCallback(async () => {
    if (emailVerified) return;
    const code = String(currentEmailCode || '').trim();
    if (code.length < 4) {
      Alert.alert('Weryfikacja', 'Wpisz kod z wiadomości.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBusyCurrentConfirm(true);
    try {
      const r = await confirmCurrentEmailVerification(code);
      if (!r?.ok) {
        Alert.alert('Weryfikacja e-mail', r?.error || 'Nieprawidłowy kod lub błąd serwera.');
        return;
      }
      await refreshUser();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('E-mail potwierdzony', 'Adres został zweryfikowany.');
      setCurrentEmailCode('');
      onClose();
    } finally {
      setBusyCurrentConfirm(false);
    }
  }, [emailVerified, currentEmailCode, confirmCurrentEmailVerification, refreshUser, onClose]);

  const surface = isDark ? 'rgba(28,28,30,0.94)' : 'rgba(255,255,255,0.97)';
  const textMain = isDark ? '#FFFFFF' : '#111827';
  const textMuted = isDark ? 'rgba(235,235,245,0.62)' : 'rgba(17,24,39,0.55)';
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(17,24,39,0.12)';
  const inputBg = isDark ? 'rgba(44,44,46,0.9)' : '#F2F2F7';
  const cardBg = isDark ? 'rgba(44,44,46,0.55)' : 'rgba(247,247,250,0.85)';

  const renderCheckInline = (state: CheckState) => {
    if (state === 'idle') return null;
    if (state === 'loading') {
      return (
        <View style={styles.checkRow}>
          <ActivityIndicator size="small" color={String(textMuted)} />
          <Text style={[styles.checkText, { color: textMuted }]}>Sprawdzam dostępność…</Text>
        </View>
      );
    }
    if (state === 'available') {
      return (
        <Text style={styles.checkOk}>Adres dostępny — możesz go użyć.</Text>
      );
    }
    if (state === 'taken') {
      return <Text style={styles.checkErr}>Ten adres e-mail jest już zajęty.</Text>;
    }
    if (state === 'invalid') {
      return <Text style={styles.checkWarn}>Nieprawidłowy format e-maila.</Text>;
    }
    if (state === 'same') {
      return <Text style={styles.checkWarn}>To jest Twój obecny adres e-mail.</Text>;
    }
    return null;
  };

  if (emailVerified) {
    return (
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
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
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
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
              Potwierdź obecny adres kodem z wiadomości albo zmień go na nowy (również z kodem).
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
                {hasPendingEmail ? (
                  <View style={[styles.banner, { borderColor: border, backgroundColor: isDark ? 'rgba(255,159,10,0.12)' : 'rgba(255,159,10,0.1)' }]}>
                    <Text style={[styles.bannerText, { color: textMain }]}>
                      Oczekuje na potwierdzenie: <Text style={{ fontWeight: '800' }}>{pendingEmail}</Text> — wpisz kod z wiadomości w trybie „Zmień adres”.
                    </Text>
                  </View>
                ) : null}

                <View style={[styles.segmentWrap, { borderColor: border, backgroundColor: inputBg }]}>
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      setVerifyMode('verify');
                    }}
                    style={[styles.segmentBtn, verifyMode === 'verify' && styles.segmentBtnActive, verifyMode === 'verify' && { backgroundColor: isDark ? '#3A3A3C' : '#FFFFFF' }]}
                  >
                    <Text style={[styles.segmentText, { color: verifyMode === 'verify' ? textMain : textMuted }]}>
                      Potwierdź obecny
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      setVerifyMode('change');
                    }}
                    style={[styles.segmentBtn, verifyMode === 'change' && styles.segmentBtnActive, verifyMode === 'change' && { backgroundColor: isDark ? '#3A3A3C' : '#FFFFFF' }]}
                  >
                    <Text style={[styles.segmentText, { color: verifyMode === 'change' ? textMain : textMuted }]}>
                      Zmień adres
                    </Text>
                  </Pressable>
                </View>

                {verifyMode === 'verify' ? (
                  <>
                    <Text style={[styles.hint, { color: textMuted }]}>
                      Wyślemy 6-cyfrowy kod na <Text style={{ color: textMain, fontWeight: '700' }}>{currentEmail || '—'}</Text>.
                    </Text>
                    <Pressable
                      onPress={() => void sendCurrentCode()}
                      disabled={busyCurrentSend}
                      style={({ pressed }) => [styles.secondaryBtnFull, { borderColor: border, opacity: pressed ? 0.85 : busyCurrentSend ? 0.6 : 1 }]}
                    >
                      {busyCurrentSend ? (
                        <ActivityIndicator color={theme.text} />
                      ) : (
                        <Text style={[styles.secondaryBtnText, { color: textMain }]}>Wyślij kod na mój adres</Text>
                      )}
                    </Pressable>
                    <Text style={[styles.label, { color: textMuted }]}>Kod z wiadomości</Text>
                    <TextInput
                      value={currentEmailCode}
                      onChangeText={setCurrentEmailCode}
                      placeholder="np. 123456"
                      placeholderTextColor={theme.subtitle}
                      keyboardType="number-pad"
                      style={[styles.input, { color: theme.text, backgroundColor: inputBg, borderColor: border }]}
                    />
                    <Pressable
                      onPress={() => void confirmCurrentCode()}
                      disabled={busyCurrentConfirm}
                      style={({ pressed }) => [
                        styles.primaryBtn,
                        { opacity: pressed ? 0.9 : busyCurrentConfirm ? 0.65 : 1, backgroundColor: '#10b981' },
                      ]}
                    >
                      {busyCurrentConfirm ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.primaryBtnText}>Potwierdź adres e-mail</Text>
                      )}
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Text style={[styles.label, { color: textMuted }]}>Nowy e-mail</Text>
                    <TextInput
                      value={newEmail}
                      onChangeText={setNewEmail}
                      placeholder="nowy@adres.pl"
                      placeholderTextColor={theme.subtitle}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      style={[
                        styles.input,
                        {
                          color: theme.text,
                          backgroundColor: inputBg,
                          borderWidth: 1,
                          borderColor:
                            emailCheck === 'taken'
                              ? 'rgba(200,52,28,0.6)'
                              : emailCheck === 'available'
                                ? 'rgba(52,199,89,0.55)'
                                : border,
                        },
                      ]}
                    />
                    {renderCheckInline(emailCheck)}
                    <Pressable
                      onPress={() => void sendEmailCode()}
                      disabled={busyEmailSend || emailBlocking}
                      style={({ pressed }) => [
                        styles.secondaryBtnFull,
                        { borderColor: border, opacity: pressed ? 0.85 : emailBlocking ? 0.45 : 1 },
                      ]}
                    >
                      {busyEmailSend ? (
                        <ActivityIndicator color={theme.text} />
                      ) : (
                        <Text style={[styles.secondaryBtnText, { color: textMain }]}>
                          {emailCheck === 'taken'
                            ? 'Adres zajęty — zmień e-mail'
                            : emailCheck === 'invalid'
                              ? 'Wpisz prawidłowy e-mail'
                              : 'Wyślij kod na nowy adres'}
                        </Text>
                      )}
                    </Pressable>
                    <Text style={[styles.label, { color: textMuted }]}>Kod z wiadomości</Text>
                    <TextInput
                      value={emailCode}
                      onChangeText={setEmailCode}
                      placeholder="np. 123456"
                      placeholderTextColor={theme.subtitle}
                      keyboardType="number-pad"
                      style={[styles.input, { color: theme.text, backgroundColor: inputBg, borderColor: border }]}
                    />
                    <Pressable
                      onPress={() => void confirmEmail()}
                      disabled={busyEmailConfirm}
                      style={({ pressed }) => [
                        styles.primaryBtn,
                        { opacity: pressed ? 0.9 : busyEmailConfirm ? 0.65 : 1, backgroundColor: '#10b981' },
                      ]}
                    >
                      {busyEmailConfirm ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.primaryBtnText}>Potwierdź nowy e-mail</Text>
                      )}
                    </Pressable>
                  </>
                )}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </BlurView>
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
  banner: { marginTop: 10, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  bannerText: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  segmentWrap: { flexDirection: 'row', borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, padding: 3, marginTop: 10, marginBottom: 4 },
  segmentBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  segmentBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentText: { fontSize: 13, fontWeight: '700', letterSpacing: -0.1 },
  hint: { fontSize: 12, lineHeight: 17, marginTop: 8 },
  label: { fontSize: 12, fontWeight: '700', marginTop: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 },
  input: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  checkText: { fontSize: 12, lineHeight: 17 },
  checkOk: { fontSize: 12, lineHeight: 17, color: '#1f8a3a', fontWeight: '700', marginTop: 6 },
  checkErr: { fontSize: 12, lineHeight: 17, color: '#c8341c', fontWeight: '700', marginTop: 6 },
  checkWarn: { fontSize: 12, lineHeight: 17, color: '#b25b00', fontWeight: '700', marginTop: 6 },
  secondaryBtnFull: {
    marginTop: 10,
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

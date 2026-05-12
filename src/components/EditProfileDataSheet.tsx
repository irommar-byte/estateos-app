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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../store/useAuthStore';

const nameChangeStorageKey = (userId: number | string) => `@estateos_profile_name_change_used_${userId}`;

type Props = {
  visible: boolean;
  onClose: () => void;
  theme: { text: string; subtitle: string; background?: string; glass?: string };
  isDark?: boolean;
};

function digitsToPhoneDraft(phone?: string | null): string {
  const raw = String(phone || '').replace(/\D/g, '');
  const nine = raw.startsWith('48') && raw.length >= 11 ? raw.slice(-9) : raw.length >= 9 ? raw.slice(-9) : raw.replace(/^48/, '');
  return nine.replace(/(\d{3})(?=\d)/g, '$1 ').trim();
}

export default function EditProfileDataSheet({ visible, onClose, theme, isDark = false }: Props) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const updateProfileBasics = useAuthStore((s: any) => s.updateProfileBasics);
  const requestProfileEmailChange = useAuthStore((s: any) => s.requestProfileEmailChange);
  const confirmProfileEmailChange = useAuthStore((s: any) => s.confirmProfileEmailChange);
  const sendCurrentEmailVerification = useAuthStore((s: any) => s.sendCurrentEmailVerification);
  const confirmCurrentEmailVerification = useAuthStore((s: any) => s.confirmCurrentEmailVerification);
  const refreshUser = useAuthStore((s) => s.refreshUser);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneDraft, setPhoneDraft] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [busyBasics, setBusyBasics] = useState(false);
  const [busyEmailSend, setBusyEmailSend] = useState(false);
  const [busyEmailConfirm, setBusyEmailConfirm] = useState(false);
  const [busyCurrentSend, setBusyCurrentSend] = useState(false);
  const [busyCurrentConfirm, setBusyCurrentConfirm] = useState(false);
  const [currentEmailCode, setCurrentEmailCode] = useState('');
  const [verifyMode, setVerifyMode] = useState<'verify' | 'change'>('verify');
  const [localNameChangeUsed, setLocalNameChangeUsed] = useState(false);
  type CheckState = 'idle' | 'loading' | 'available' | 'taken' | 'invalid' | 'same';
  const [emailCheck, setEmailCheck] = useState<CheckState>('idle');
  const [phoneCheck, setPhoneCheck] = useState<CheckState>('idle');

  const phoneVerified = Boolean(user?.isVerifiedPhone);
  const emailVerified = Boolean(user?.isEmailVerified);
  const emailBlocking = emailCheck === 'taken' || emailCheck === 'invalid' || emailCheck === 'loading' || emailCheck === 'same' || emailCheck === 'idle';
  const phoneBlocking = phoneCheck === 'taken' || phoneCheck === 'invalid';
  const currentEmail = String(user?.email || '').trim();
  const pendingEmail = String(user?.pendingEmail || '').trim();
  const hasPendingEmail = pendingEmail.length > 0 && pendingEmail.toLowerCase() !== currentEmail.toLowerCase();
  const namesLocked = Boolean(user?.profileNameLocked) || localNameChangeUsed;

  useEffect(() => {
    if (!visible || !user) return;
    setFirstName(String(user.firstName || '').trim());
    setLastName(String(user.lastName || '').trim());
    setPhoneDraft(digitsToPhoneDraft(user.phone));
    const pending = String(user.pendingEmail || '').trim();
    setNewEmail(pending && pending.toLowerCase() !== String(user.email || '').trim().toLowerCase() ? pending : '');
    setEmailCode('');
    let cancelled = false;
    (async () => {
      try {
        const v = await AsyncStorage.getItem(nameChangeStorageKey(user.id));
        if (!cancelled) setLocalNameChangeUsed(v === '1');
      } catch {
        if (!cancelled) setLocalNameChangeUsed(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, user?.id]);

  const handlePhoneChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '').substring(0, 9);
    const parts = cleaned.match(/.{1,3}/g);
    setPhoneDraft(parts ? parts.join(' ') : cleaned);
  };

  /** Walidacja dostępności e-maila — od razu z debounce, używa endpointu rejestracji. */
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
        const res = await fetch('https://estateos.pl/api/auth/check-exists', {
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
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        } else {
          setEmailCheck('available');
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
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

  /** Walidacja dostępności numeru telefonu — analogicznie. */
  useEffect(() => {
    if (!visible || phoneVerified) {
      setPhoneCheck('idle');
      return;
    }
    const clean = String(phoneDraft || '').replace(/\s/g, '');
    if (!clean) {
      setPhoneCheck('idle');
      return;
    }
    if (clean.length !== 9) {
      setPhoneCheck('invalid');
      return;
    }
    const currentClean = String(user?.phone || '').replace(/\D/g, '').slice(-9);
    if (currentClean && clean === currentClean) {
      setPhoneCheck('same');
      return;
    }
    setPhoneCheck('loading');
    const ctrl = new AbortController();
    const e164 = '+48 ' + clean;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('https://estateos.pl/api/auth/check-exists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: e164, field: 'phone', value: e164 }),
          signal: ctrl.signal,
        });
        if (!res.ok) {
          setPhoneCheck('idle');
          return;
        }
        const d = await res.json().catch(() => ({} as any));
        if (d?.exists === true || d?.taken === true) {
          setPhoneCheck('taken');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        } else {
          setPhoneCheck('available');
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
      } catch {
        setPhoneCheck('idle');
      }
    }, 500);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [visible, phoneDraft, phoneVerified, user?.phone]);

  const saveBasics = useCallback(async () => {
    if (!user || busyBasics) return;
    const fn = String(firstName || '').trim();
    const ln = String(lastName || '').trim();
    const prevFn = String(user.firstName || '').trim();
    const prevLn = String(user.lastName || '').trim();
    const namesChanged = fn !== prevFn || ln !== prevLn;

    if (namesLocked && phoneVerified) {
      Alert.alert('Brak zmian', 'Imię i nazwisko są już zatwierdzone, a numer telefonu jest potwierdzony — nie ma nic do zapisania.');
      return;
    }

    if (!namesLocked) {
      if (!fn || !ln) {
        Alert.alert('Dane', 'Uzupełnij imię i nazwisko.');
        return;
      }
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBusyBasics(true);
    try {
      const payload: { firstName?: string; lastName?: string; phone?: string } = {};
      if (!namesLocked) {
        payload.firstName = fn;
        payload.lastName = ln;
      }
      if (!phoneVerified) {
        const d = phoneDraft.replace(/\s/g, '');
        if (d.length !== 9) {
          Alert.alert('Telefon', 'Podaj 9 cyfr numeru (bez +48).');
          setBusyBasics(false);
          return;
        }
        payload.phone = `+48 ${d.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')}`;
      }

      if (namesLocked && !payload.phone) {
        Alert.alert('Brak zmian', 'Nie wprowadzono nowego numeru telefonu.');
        setBusyBasics(false);
        return;
      }

      const r = await updateProfileBasics(payload);
      if (!r?.ok) {
        Alert.alert('Nie udało się zapisać', r?.error || 'Spróbuj ponownie.');
        return;
      }

      if (!namesLocked && namesChanged && user?.id) {
        try {
          await AsyncStorage.setItem(nameChangeStorageKey(user.id), '1');
          setLocalNameChangeUsed(true);
        } catch {
          /* best-effort */
        }
      }

      await refreshUser();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Zapisano', 'Dane profilowe zostały zaktualizowane.');
      onClose();
    } finally {
      setBusyBasics(false);
    }
  }, [
    user,
    busyBasics,
    firstName,
    lastName,
    phoneDraft,
    phoneVerified,
    namesLocked,
    updateProfileBasics,
    refreshUser,
    onClose,
  ]);

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
        'Na nowy adres e-mail wysłano wiadomość z kodem. Wpisz kod poniżej i potwierdź — dopiero wtedy adres zostanie zmieniony.'
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

  /** Wysyłka kodu na **bieżący** e-mail (potwierdzenie po rejestracji). */
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

  /** Potwierdzenie kodu wysłanego na bieżący adres. */
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
    } finally {
      setBusyCurrentConfirm(false);
    }
  }, [emailVerified, currentEmailCode, confirmCurrentEmailVerification, refreshUser]);

  const surface = isDark ? 'rgba(28,28,30,0.94)' : 'rgba(255,255,255,0.97)';
  const textMain = isDark ? '#FFFFFF' : '#111827';
  const textMuted = isDark ? 'rgba(235,235,245,0.62)' : 'rgba(17,24,39,0.55)';
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(17,24,39,0.12)';
  const inputBg = isDark ? 'rgba(44,44,46,0.9)' : '#F2F2F7';
  const cardBg = isDark ? 'rgba(44,44,46,0.55)' : 'rgba(247,247,250,0.85)';

  const renderCheckInline = (state: 'idle' | 'loading' | 'available' | 'taken' | 'invalid' | 'same', kind: 'email' | 'phone') => {
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
        <View style={[styles.checkRow, styles.checkRowOk]}>
          <Ionicons name="checkmark-circle" size={16} color="#1f8a3a" />
          <Text style={styles.checkTextOk}>{kind === 'email' ? 'Adres dostępny — możesz go użyć.' : 'Numer dostępny — możesz go użyć.'}</Text>
        </View>
      );
    }
    if (state === 'taken') {
      return (
        <View style={[styles.checkRow, styles.checkRowErr]}>
          <Ionicons name="close-circle" size={16} color="#c8341c" />
          <Text style={styles.checkTextErr}>{kind === 'email' ? 'Ten adres e-mail jest już zajęty.' : 'Ten numer telefonu jest już używany.'}</Text>
        </View>
      );
    }
    if (state === 'invalid') {
      return (
        <View style={[styles.checkRow, styles.checkRowWarn]}>
          <Ionicons name="alert-circle" size={16} color="#b25b00" />
          <Text style={styles.checkTextWarn}>{kind === 'email' ? 'Nieprawidłowy format e-maila.' : 'Wpisz 9 cyfr numeru telefonu.'}</Text>
        </View>
      );
    }
    if (state === 'same') {
      return (
        <View style={[styles.checkRow, styles.checkRowWarn]}>
          <Ionicons name="information-circle" size={16} color="#b25b00" />
          <Text style={styles.checkTextWarn}>{kind === 'email' ? 'To jest Twój obecny adres e-mail.' : 'To jest Twój obecny numer telefonu.'}</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <BlurView intensity={isDark ? 55 : 70} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.wrap, { paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 12) }]}
        >
          <View style={[styles.sheet, { backgroundColor: surface, borderColor: border }]}>
            <View style={[styles.dragBar, { backgroundColor: isDark ? '#3A3A3C' : '#E5E7EB' }]} />
            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: textMain }]}>Edytuj dane</Text>
              <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={String(textMuted)} />
              </Pressable>
            </View>
            <Text style={[styles.sub, { color: textMuted }]}>
              Imię i nazwisko można poprawić tylko raz (np. literówka po rejestracji), potem pola są zablokowane. Nowy e-mail działa dopiero po weryfikacji kodu. Telefon można zmienić wyłącznie zanim zostanie potwierdzony SMS-em — potem jest zablokowany.
            </Text>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
              {/* ───── Sekcja: Dane osobowe ───── */}
              <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: border }]}>
                <View style={styles.sectionTitleRow}>
                  <View style={styles.sectionTitleLeft}>
                    <Ionicons name="person-circle-outline" size={18} color={String(textMuted)} />
                    <Text style={[styles.sectionTitle, { color: textMain }]}>Dane osobowe</Text>
                  </View>
                </View>
                <Text style={[styles.sectionSub, { color: textMuted }]}>Imię, nazwisko i numer telefonu</Text>

                <Text style={[styles.label, { color: textMuted }]}>Imię</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="Imię"
                    placeholderTextColor={theme.subtitle}
                    editable={!namesLocked}
                    style={[
                      styles.input,
                      styles.inputFlex,
                      { color: theme.text, backgroundColor: inputBg, borderColor: border },
                      namesLocked && styles.inputDisabled,
                    ]}
                    autoCapitalize="words"
                  />
                  {namesLocked ? (
                    <View style={[styles.confirmedPill, { borderColor: border }]}>
                      <Text style={[styles.confirmedPillText, { color: textMuted }]}>Potwierdzony</Text>
                    </View>
                  ) : null}
                </View>
                {namesLocked ? (
                  <Text style={[styles.hint, { color: textMuted }]}>Dane imienne zostały już raz poprawione — dalsza zmiana w aplikacji jest wyłączona.</Text>
                ) : null}

                <Text style={[styles.label, { color: textMuted }]}>Nazwisko</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Nazwisko"
                    placeholderTextColor={theme.subtitle}
                    editable={!namesLocked}
                    style={[
                      styles.input,
                      styles.inputFlex,
                      { color: theme.text, backgroundColor: inputBg, borderColor: border },
                      namesLocked && styles.inputDisabled,
                    ]}
                    autoCapitalize="words"
                  />
                  {namesLocked ? (
                    <View style={[styles.confirmedPill, { borderColor: border }]}>
                      <Text style={[styles.confirmedPillText, { color: textMuted }]}>Potwierdzony</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.labelRow}>
                  <Text style={[styles.label, { color: textMuted, marginTop: 0, marginBottom: 0 }]}>Telefon</Text>
                  {phoneVerified ? (
                    <View style={[styles.statusPill, styles.statusPillOk]}>
                      <Ionicons name="checkmark-circle" size={12} color="#1f8a3a" />
                      <Text style={styles.statusPillTextOk}>Potwierdzony</Text>
                    </View>
                  ) : (
                    <View style={[styles.statusPill, styles.statusPillWarn]}>
                      <Ionicons name="alert-circle" size={12} color="#b25b00" />
                      <Text style={styles.statusPillTextWarn}>Niepotwierdzony</Text>
                    </View>
                  )}
                </View>
                <View style={styles.inputRow}>
                  <TextInput
                    value={phoneDraft}
                    onChangeText={handlePhoneChange}
                    placeholder="000 000 000"
                    placeholderTextColor={theme.subtitle}
                    keyboardType="number-pad"
                    editable={!phoneVerified}
                    style={[
                      styles.input,
                      styles.inputFlex,
                      { color: theme.text, backgroundColor: inputBg, borderColor: border },
                      phoneVerified && styles.inputDisabled,
                      !phoneVerified && phoneCheck === 'taken' && styles.inputBorderErr,
                      !phoneVerified && phoneCheck === 'available' && styles.inputBorderOk,
                    ]}
                  />
                </View>
                {!phoneVerified ? renderCheckInline(phoneCheck, 'phone') : null}
                {phoneVerified ? (
                  <Text style={[styles.hint, { color: textMuted }]}>
                    Numer jest potwierdzony SMS-em — edycja w aplikacji jest wyłączona ze względów bezpieczeństwa.
                  </Text>
                ) : (
                  <>
                    <Text style={[styles.hint, { color: textMuted }]}>
                      9 cyfr bez prefiksu +48 (prefiks dodamy przy zapisie). Po potwierdzeniu SMS-em zmiana będzie zablokowana.
                    </Text>
                    <Pressable
                      onPress={() => {
                        Haptics.selectionAsync();
                        onClose();
                        setTimeout(() => {
                          try {
                            navigation.navigate('SmsVerification');
                          } catch {}
                        }, 250);
                      }}
                      style={({ pressed }) => [styles.inlineLinkBtn, pressed && { opacity: 0.7 }]}
                    >
                      <Ionicons name="shield-checkmark" size={14} color="#0a84ff" />
                      <Text style={styles.inlineLinkText}>Zweryfikuj numer kodem SMS</Text>
                    </Pressable>
                  </>
                )}

                <Pressable
                  onPress={() => void saveBasics()}
                  disabled={busyBasics || (namesLocked && phoneVerified) || (!phoneVerified && phoneBlocking)}
                  style={({ pressed }) => [
                    styles.saveBtn,
                    {
                      opacity: pressed
                        ? 0.92
                        : (namesLocked && phoneVerified) || (!phoneVerified && phoneBlocking)
                          ? 0.45
                          : 1,
                      backgroundColor: isDark ? '#3A3A3C' : '#1d1d1f',
                    },
                    busyBasics && { opacity: 0.65 },
                  ]}
                >
                  {busyBasics ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveBtnText}>
                      {namesLocked && phoneVerified
                        ? 'Brak zmian do zapisu'
                        : !phoneVerified && phoneCheck === 'taken'
                          ? 'Numer telefonu zajęty'
                          : 'Zapisz dane'}
                    </Text>
                  )}
                </Pressable>
              </View>

              {/* ───── Sekcja: Adres e-mail ───── */}
              <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: border, marginTop: 14 }]}>
                <View style={styles.sectionTitleRow}>
                  <View style={styles.sectionTitleLeft}>
                    <Ionicons name="mail-outline" size={18} color={String(textMuted)} />
                    <Text style={[styles.sectionTitle, { color: textMain }]}>
                      {emailVerified ? 'Zmiana e-mail' : 'Adres e-mail'}
                    </Text>
                  </View>
                  {emailVerified ? (
                    <View style={[styles.statusPill, styles.statusPillOk]}>
                      <Ionicons name="checkmark-circle" size={12} color="#1f8a3a" />
                      <Text style={styles.statusPillTextOk}>Potwierdzony</Text>
                    </View>
                  ) : (
                    <View style={[styles.statusPill, styles.statusPillWarn]}>
                      <Ionicons name="alert-circle" size={12} color="#b25b00" />
                      <Text style={styles.statusPillTextWarn}>Niepotwierdzony</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.sectionSub, { color: textMuted }]}>
                  Obecny: <Text style={{ color: textMain, fontWeight: '700' }}>{currentEmail || '—'}</Text>
                </Text>
                {hasPendingEmail && !emailVerified ? (
                  <View style={[styles.confirmedBanner, { borderColor: border, backgroundColor: isDark ? 'rgba(255,159,10,0.12)' : 'rgba(255,159,10,0.1)' }]}>
                    <Text style={[styles.confirmedBannerText, { color: textMain }]}>
                      Oczekuje na potwierdzenie:{' '}
                      <Text style={{ fontWeight: '800' }}>{pendingEmail}</Text> — wpisz kod z wiadomości poniżej.
                    </Text>
                  </View>
                ) : null}

                {emailVerified ? (
                  <>
                    <TextInput
                      value={currentEmail}
                      editable={false}
                      style={[styles.input, { color: theme.text, backgroundColor: inputBg, borderColor: border, opacity: 0.55, marginTop: 8 }]}
                    />
                    <View style={[styles.confirmedBanner, { borderColor: border, backgroundColor: isDark ? 'rgba(52,199,89,0.12)' : 'rgba(52,199,89,0.1)' }]}>
                      <Text style={[styles.confirmedBannerText, { color: textMain }]}>E-mail potwierdzony — zmiana w aplikacji jest wyłączona.</Text>
                    </View>
                  </>
                ) : (
                  <>
                    {/* segmentowy przełącznik trybu */}
                    <View style={[styles.segmentWrap, { borderColor: border, backgroundColor: inputBg }]}>
                      <Pressable
                        onPress={() => { Haptics.selectionAsync(); setVerifyMode('verify'); }}
                        style={[styles.segmentBtn, verifyMode === 'verify' && styles.segmentBtnActive, verifyMode === 'verify' && { backgroundColor: isDark ? '#3A3A3C' : '#FFFFFF' }]}
                      >
                        <Text style={[styles.segmentText, { color: verifyMode === 'verify' ? textMain : textMuted }]}>
                          Potwierdź obecny
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => { Haptics.selectionAsync(); setVerifyMode('change'); }}
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
                          Wyślemy 6-cyfrowy kod na <Text style={{ color: textMain, fontWeight: '700' }}>{currentEmail || '—'}</Text>. Po potwierdzeniu adres będzie zweryfikowany i edycja w aplikacji zostanie zablokowana.
                        </Text>
                        <Pressable
                          onPress={() => void sendCurrentCode()}
                          disabled={busyCurrentSend}
                          style={({ pressed }) => [
                            styles.secondaryBtn,
                            { borderColor: border, opacity: pressed ? 0.85 : 1 },
                            busyCurrentSend && { opacity: 0.6 },
                          ]}
                        >
                          {busyCurrentSend ? (
                            <ActivityIndicator color={theme.text} />
                          ) : (
                            <Text style={[styles.secondaryBtnText, { color: textMain }]}>Wyślij kod na mój adres</Text>
                          )}
                        </Pressable>

                        <Text style={[styles.label, { color: textMuted, marginTop: 12 }]}>Kod z wiadomości</Text>
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
                            { opacity: pressed ? 0.9 : 1, backgroundColor: '#10b981' },
                            busyCurrentConfirm && { opacity: 0.65 },
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
                            { color: theme.text, backgroundColor: inputBg, borderColor: border },
                            emailCheck === 'taken' && styles.inputBorderErr,
                            emailCheck === 'available' && styles.inputBorderOk,
                          ]}
                        />
                        {renderCheckInline(emailCheck, 'email')}
                        <Pressable
                          onPress={() => void sendEmailCode()}
                          disabled={busyEmailSend || emailBlocking}
                          style={({ pressed }) => [
                            styles.secondaryBtn,
                            { borderColor: border, opacity: pressed ? 0.85 : emailBlocking ? 0.45 : 1 },
                            busyEmailSend && { opacity: 0.6 },
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

                        <Text style={[styles.label, { color: textMuted, marginTop: 12 }]}>Kod z wiadomości</Text>
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
                            { opacity: pressed ? 0.9 : 1, backgroundColor: '#10b981' },
                            busyEmailConfirm && { opacity: 0.65 },
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
    maxHeight: '92%',
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  dragBar: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginTop: 8, marginBottom: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeBtn: { padding: 4 },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  sub: { fontSize: 13, lineHeight: 19, marginTop: 6, marginBottom: 8 },
  scroll: { paddingBottom: 24 },
  label: { fontSize: 12, fontWeight: '700', marginTop: 10, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputFlex: { flex: 1 },
  inputDisabled: { opacity: 0.55 },
  inputBorderOk: { borderColor: 'rgba(52,199,89,0.6)', borderWidth: 1.5 },
  inputBorderErr: { borderColor: 'rgba(200,52,28,0.6)', borderWidth: 1.5 },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 2,
  },
  checkRowOk: {},
  checkRowErr: {},
  checkRowWarn: {},
  checkText: { fontSize: 12, lineHeight: 17 },
  checkTextOk: { fontSize: 12, lineHeight: 17, color: '#1f8a3a', fontWeight: '700' },
  checkTextErr: { fontSize: 12, lineHeight: 17, color: '#c8341c', fontWeight: '700' },
  checkTextWarn: { fontSize: 12, lineHeight: 17, color: '#b25b00', fontWeight: '700' },
  segmentWrap: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 3,
    marginTop: 10,
    marginBottom: 4,
  },
  segmentBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  segmentBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentText: { fontSize: 13, fontWeight: '700', letterSpacing: -0.1 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 6 },
  sectionCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitleLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionSub: { fontSize: 12, lineHeight: 17, marginTop: 4, marginBottom: 4 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statusPillOk: { backgroundColor: 'rgba(52,199,89,0.14)', borderColor: 'rgba(52,199,89,0.35)' },
  statusPillWarn: { backgroundColor: 'rgba(255,159,10,0.16)', borderColor: 'rgba(255,159,10,0.45)' },
  statusPillTextOk: { color: '#1f8a3a', fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  statusPillTextWarn: { color: '#b25b00', fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  inlineLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  inlineLinkText: { color: '#0a84ff', fontSize: 13, fontWeight: '700' },
  confirmedPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  confirmedPillText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  confirmedBanner: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  confirmedBannerText: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  hint: { fontSize: 12, lineHeight: 17, marginTop: 6 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  secondaryBtn: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '700' },
  primaryBtn: { marginTop: 12, borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  saveBtn: { marginTop: 16, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});

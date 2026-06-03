import { useNavigation } from "@react-navigation/native";
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
  Animated,
  Modal,
  Easing,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { CountryCode } from 'libphonenumber-js';
import { isValidPhoneNumber, parsePhoneNumberFromString } from 'libphonenumber-js';
import PhoneCountryPickerModal from '../components/phone/PhoneCountryPickerModal';
import { API_URL } from '../config/network';
import {
  buildE164FromNational,
  dialCodeFor,
  formatNationalAsYouType,
  getDeviceRegionCountry,
  flagEmojiFromIso2,
} from '../utils/phoneRegions';
import { useI18n } from '../i18n';

// --- LUKSUSOWE IKONY WALIDACJI ---
const StatusIcon = ({ status }: { status: string }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: status === 'idle' ? 0 : 1, duration: 300, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: status === 'idle' ? 0.5 : 1, friction: 5, useNativeDriver: true })
    ]).start();
  }, [status]);

  const getBgColor = () => {
    if (status === 'available') return 'rgba(16, 185, 129, 0.15)';
    if (status === 'taken') return 'rgba(239, 68, 68, 0.15)';
    return 'transparent';
  };

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }], marginLeft: 10, width: 30, height: 30, borderRadius: 15, backgroundColor: getBgColor(), alignItems: 'center', justifyContent: 'center' }}>
      {status === 'loading' && <ActivityIndicator size="small" color="#10b981" />}
      {status === 'available' && <Ionicons name="checkmark" size={20} color="#10b981" style={{ fontWeight: '900' }} />}
      {status === 'taken' && <Ionicons name="close" size={22} color="#ef4444" style={{ fontWeight: '900' }} />}
    </Animated.View>
  );
};

/** Ikona oka — przełącza podgląd wpisywanego hasła (logowanie, rejestracja, reset). */
function PasswordEyeToggle({
  revealed,
  onToggle,
  iconColor,
  a11yHide,
  a11yShow,
}: {
  revealed: boolean;
  onToggle: () => void;
  iconColor: string;
  a11yHide: string;
  a11yShow: string;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onToggle();
      }}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      accessibilityRole="button"
      accessibilityLabel={revealed ? a11yHide : a11yShow}
    >
      <Ionicons name={revealed ? 'eye-off-outline' : 'eye-outline'} size={22} color={iconColor} />
    </Pressable>
  );
}

// --- ANIMOWANY CHECKBOX Z EFEKTEM GLOW ---
const PremiumCheckbox = ({ checked, onPress, onReadTerms, onReadPrivacy, theme, t }: any) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: checked ? 1 : 0.9, friction: 4, useNativeDriver: true }).start();
  }, [checked]);

  return (
    <View style={styles.checkboxContainer}>
      <Pressable onPress={onPress} style={({pressed}) => [{ opacity: pressed ? 0.7 : 1 }, styles.checkboxTouchArea]}>
        <Animated.View style={[
          styles.checkboxBox, 
          { borderColor: checked ? '#10b981' : theme.subtitle },
          checked && { backgroundColor: '#10b981', shadowColor: '#10b981', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 8, elevation: 5, transform: [{ scale: scaleAnim }] }
        ]}>
          {checked && <Ionicons name="checkmark" size={16} color="#fff" style={{ fontWeight: '900' }} />}
        </Animated.View>
      </Pressable>
      <View style={styles.checkboxTextContainer}>
        <Text style={[styles.checkboxText, { color: theme.subtitle }]}>
          {t('auth.termsPrefix')}
          <Text onPress={onReadTerms} style={{ color: theme.text, fontWeight: '700', textDecorationLine: 'underline' }}>{t('auth.termsLink')}</Text>
          {t('auth.termsMiddle')}
          <Text onPress={onReadPrivacy} style={{ color: theme.text, fontWeight: '700', textDecorationLine: 'underline' }}>{t('auth.privacyLink')}</Text>
          {t('auth.termsSuffix')}
        </Text>
      </View>
    </View>
  );
};

// --- MODAL: RESET HASŁA ---
const ForgotPasswordModal = ({ visible, onClose, theme, t }: any) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordVisible, setNewPasswordVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const isDark = theme.glass === 'dark';
  const cardBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
  const cardBg = isDark ? 'rgba(255,255,255,0.05)' : '#ffffff';

  useEffect(() => {
    if (!visible) {
      setStep(1);
      setEmail('');
      setOtp('');
      setNewPassword('');
      setNewPasswordVisible(false);
    }
  }, [visible]);

  const handleSendEmailCode = async () => {
    if (!email.includes('@')) return Alert.alert(t('common.error'), t('auth.invalidEmail'));
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: email })
      });
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setStep(2);
      } else {
        const d = await res.json();
        Alert.alert(t('common.error'), d.message || t('auth.userNotFound'));
      }
    } catch { Alert.alert(t('common.error'), t('common.networkError')); }
    setLoading(false);
  };

  const handleFinalReset = async () => {
    if (otp.length < 4) return Alert.alert(t('common.error'), t('auth.enterOtp'));
    if (newPassword.length < 6) return Alert.alert(t('common.error'), t('auth.passwordMin6'));
    
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ identifier: email, otp, newPassword })
      });
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(t('common.successTitle'), t('auth.passwordChanged'), [{ text: t('common.super'), onPress: onClose }]);
      } else {
        Alert.alert(t('common.error'), t('auth.invalidOtp'));
      }
    } catch { Alert.alert(t('common.error'), t('auth.resetFailed')); }
    setLoading(false);
  };

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="overFullScreen" transparent={true}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 }}>
        <View style={{ backgroundColor: theme.background, borderRadius: 30, padding: 25, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>{step === 1 ? t('auth.resetTitle1') : t('auth.resetTitle2')}</Text>
            <Pressable onPress={onClose}><Ionicons name="close-circle" size={28} color={theme.subtitle} /></Pressable>
          </View>
          {step === 1 ? (
            <View>
              <Text style={{ color: theme.subtitle, marginBottom: 20, fontSize: 14 }}>{t('auth.resetHint1')}</Text>
              <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                <View style={styles.inputRow}>
                  <TextInput style={[styles.input, { color: theme.text, flex: 1 }]} placeholder={t('auth.emailPlaceholder')} autoCapitalize="none" keyboardType="email-address" placeholderTextColor={theme.subtitle} value={email} onChangeText={setEmail} />
                </View>
              </View>
              <Pressable onPress={handleSendEmailCode} style={[styles.mainButton, { backgroundColor: '#10b981', marginTop: 20 }]}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.mainButtonText}>{t('auth.sendCode')}</Text>}
              </Pressable>
            </View>
          ) : (
            <View>
              <Text style={{ color: theme.subtitle, marginBottom: 15, fontSize: 14 }}>{t('auth.resetHint2')}</Text>
              <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                <View style={styles.inputRow}>
                  <Ionicons name="mail-open-outline" size={20} color={theme.subtitle} style={{marginRight: 10}} />
                  <TextInput style={[styles.input, { color: theme.text, flex: 1 }]} placeholder={t('auth.otpPlaceholder')} keyboardType="numeric" placeholderTextColor={theme.subtitle} value={otp} onChangeText={setOtp} />
                </View>
                <View style={[styles.divider, { backgroundColor: cardBorder }]} />
                <View style={styles.inputRow}>
                  <Ionicons name="key-outline" size={20} color={theme.subtitle} style={{ marginRight: 10 }} />
                  <TextInput
                    style={[styles.input, { color: theme.text, flex: 1 }]}
                    placeholder={t('auth.newPasswordPlaceholder')}
                    secureTextEntry={!newPasswordVisible}
                    placeholderTextColor={theme.subtitle}
                    value={newPassword}
                    onChangeText={setNewPassword}
                  />
                  <PasswordEyeToggle
                    revealed={newPasswordVisible}
                    onToggle={() => setNewPasswordVisible((v) => !v)}
                    iconColor={theme.subtitle}
                    a11yHide={t('auth.hidePassword')}
                    a11yShow={t('auth.showPassword')}
                  />
                </View>
              </View>
              <Pressable onPress={handleFinalReset} style={[styles.mainButton, { backgroundColor: '#10b981', marginTop: 20 }]}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.mainButtonText}>{t('auth.changePassword')}</Text>}
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};


export default function AuthScreen({
  theme,
  authIntent,
  prefillEmail,
  embedded = false,
}: {
  theme: any;
  /** Z nawigacji (np. gość z oferty): który formularz pokazać od razu. */
  authIntent?: 'login' | 'register';
  /** E-mail z passkey promptu — wstępne wypełnienie pola logowania. */
  prefillEmail?: string;
  /** Render w zakładce Profil — bez animacji „warp” i bez navigate('Profil'). */
  embedded?: boolean;
}) {
  const { t } = useI18n();
  const navigation = useNavigation<any>();
  const [isLogin, setIsLogin] = useState(() => (authIntent === 'register' ? false : true));
  const [isForgotModalVisible, setIsForgotModalVisible] = useState(false);
  /**
   * Role dostępne przy rejestracji:
   *  • PRIVATE — osoba prywatna sprzedająca/wynajmująca własną
   *    nieruchomość.
   *  • AGENT   — agent nieruchomości reprezentujący biuro / agencję.
   *    Wymaga podania `companyName` (nazwa biura).
   *
   * UWAGA: rola PARTNER (do współpracy z EstateOS™) celowo NIE jest
   * dostępna przy rejestracji mobilnej — partner zakłada konto przez
   * dedykowany onboarding na stronie WWW. Nie mylić z AGENT.
   */
  const [role, setRole] = useState<'PRIVATE' | 'AGENT'>('PRIVATE');
  const [email, setEmail] = useState(() => String(prefillEmail || '').trim());
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  /** Pełna nazwa biura / agencji — widoczna i wymagana TYLKO dla AGENT. */
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  const [emailStatus, setEmailStatus] = useState<'idle' | 'loading' | 'available' | 'taken'>('idle');
  const [phoneStatus, setPhoneStatus] = useState<'idle' | 'loading' | 'available' | 'taken'>('idle');
  const [phoneCountryIso, setPhoneCountryIso] = useState<CountryCode>(() => getDeviceRegionCountry());
  const [phonePickerOpen, setPhonePickerOpen] = useState(false);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);

  const store = useAuthStore() as any;
  const isDark = theme.glass === 'dark';

  // 🚀 ZJAWISKOWA ANIMACJA HYPER-DRIVE 🚀
  const warpAnim = useRef(new Animated.Value(0)).current;
  const successGlowAnim = useRef(new Animated.Value(0)).current;

  const handlePhoneChange = (text: string) => {
    const d = text.replace(/\D/g, '');
    setPhone(formatNationalAsYouType(phoneCountryIso, d));
  };

  useEffect(() => {
    if (isLogin) return;
    setPhone((prev) => formatNationalAsYouType(phoneCountryIso, prev.replace(/\D/g, '')));
  }, [phoneCountryIso, isLogin]);

  useEffect(() => {
    if (isLogin || email.length < 5 || !email.includes('@')) { setEmailStatus('idle'); return; }
    const timer = setTimeout(async () => {
      setEmailStatus('loading');
      try {
        const res = await fetch(`${API_URL}/api/auth/check-exists`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email, field: 'email', value: email })
        });
        if (!res.ok) throw new Error();
        const d = await res.json();
        if (d.exists === true || d.taken === true) {
          setEmailStatus('taken'); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } else {
          setEmailStatus('available'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      } catch { setEmailStatus('idle'); }
    }, 600);
    return () => clearTimeout(timer);
  }, [email, isLogin]);

  useEffect(() => {
    const cleanDigits = phone.replace(/\D/g, '');
    if (isLogin || !cleanDigits) {
      setPhoneStatus('idle');
      return;
    }
    const e164 = buildE164FromNational(phoneCountryIso, cleanDigits);
    if (!e164 || !isValidPhoneNumber(e164)) {
      setPhoneStatus('idle');
      return;
    }
    const timer = setTimeout(async () => {
      setPhoneStatus('loading');
      try {
        const res = await fetch(`${API_URL}/api/auth/check-exists`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: e164, field: 'phone', value: e164 }),
        });
        if (!res.ok) throw new Error();
        const d = await res.json();
        if (d.exists === true || d.taken === true) {
          setPhoneStatus('taken'); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } else {
          setPhoneStatus('available'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      } catch { setPhoneStatus('idle'); }
    }, 600);
    return () => clearTimeout(timer);
  }, [phone, isLogin, phoneCountryIso]);

  useEffect(() => {
    setPasswordVisible(false);
  }, [isLogin]);

  useEffect(() => {
    if (authIntent === 'register') setIsLogin(false);
    else if (authIntent === 'login') setIsLogin(true);
  }, [authIntent]);

  useEffect(() => {
    const next = String(prefillEmail || '').trim();
    if (next) setEmail(next);
  }, [prefillEmail]);

  const handleSubmit = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if (isLogin) {
        const normalizedEmail = String(email || '').trim().toLowerCase();
        const normalizedPassword = String(password || '');
        const ok = await store.login(normalizedEmail, normalizedPassword);
        if (!ok) {
          Alert.alert(t('auth.loginErrorTitle'), store.error || t('auth.loginFailed'));
          return;
        }
      } else {
        const regDigits = phone.replace(/\D/g, '');
        const regE164 = buildE164FromNational(phoneCountryIso, regDigits);
        if (!firstName || !lastName || !regE164 || !isValidPhoneNumber(regE164)) {
          Alert.alert(t('common.error'), t('auth.fillBusinessCard'));
          return;
        }
        if (role === 'AGENT' && companyName.trim().length < 2) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert(t('auth.agencyMissingTitle'), t('auth.agencyMissingBody'));
          return;
        }
        if (emailStatus === 'taken') { Alert.alert(t('common.error'), t('auth.emailTaken')); return; }
        if (phoneStatus === 'taken') { Alert.alert(t('common.error'), t('auth.phoneTaken')); return; }
        
        if (!termsAccepted) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert(t('auth.termsRequiredTitle'), t('auth.termsRequired'));
          return;
        }

        const isRegistered = await store.register(
          email,
          password,
          firstName,
          lastName,
          regE164,
          role,
          role === 'AGENT' ? companyName.trim() : null,
        );
        
        if (isRegistered) {
          const isLogged = await store.login(email, password, { registrationPhoneE164: regE164 });
          if (isLogged) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            // Od razu po rejestracji wysyłamy kod weryfikacyjny na podany e-mail (jeśli backend wspiera).
            const verifySend = await store
              .sendCurrentEmailVerification()
              .catch(() => ({ ok: false, error: 'Wysyłka kodu nieudana.' } as { ok: boolean; error?: string }));
            const verifiedMsg = verifySend?.ok
              ? t('auth.accountCreatedVerified', { email })
              : t('auth.accountCreatedFallback');
            Alert.alert(
              t('auth.accountCreatedTitle'),
              verifiedMsg,
              [{ text: t('auth.understand'), style: 'default' }]
            );
          } else {
            Alert.alert(t('common.success'), t('auth.accountCreated'));
            setIsLogin(true);
          }
        }
      }
    } catch (e: any) { Alert.alert(t('common.error'), e.message); }
  };

  // 🔥 MISTRZOWSKA OBSŁUGA PASSKEY Z EFEKTEM 3D 🔥
  const handlePasskey = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); 
    setIsPasskeyLoading(true);
    
    try { 
      // 1. Oczekujemy na weryfikację Face ID. Store obsłuży dane i token, w ciszy.
      const success = await store.loginWithPasskey(email); 

      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (embedded) {
          // Profil sam przełączy się na widok zalogowany — bez navigate i bez 3D (stabilność RN).
          return;
        }
        Animated.sequence([
          Animated.timing(successGlowAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: false,
          }),
          Animated.timing(warpAnim, {
            toValue: 1,
            duration: 850,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            useNativeDriver: true,
          }),
        ]).start(() => {
          try {
            navigation.navigate('Profil');
          } catch {
            // noop
          }
        });
      }
    } catch (e: any) {
      // PasskeyService już pokaże konkretny, przyjazny komunikat (Brak klucza / Face ID wyłączone /
      // Brak sieci / Błąd konfiguracji). Tu wyłapujemy tylko sytuacje, których nie objęła warstwa serwisu
      // (np. błędy w samym storze przy zapisie tokena/AsyncStorage) — wówczas pokazujemy generyczny komunikat.
      const msg = String(e?.message || '').toLowerCase();
      const isCancelLike = /cancel|cancelled|canceled|anulow/.test(msg);
      const handledByService =
        /brak klucza|face id|touch id|brak po\u0142\u0105czenia|niezgodno\u015b\u0107|logowanie face id|chwilowy problem|nie uda\u0142o si\u0119 doda\u0107|biometri/i.test(msg);
      if (!isCancelLike && !handledByService && msg) {
        Alert.alert(t('auth.passkeyFailedTitle'), t('auth.passkeyFailedBody'));
      }
    } finally {
      setIsPasskeyLoading(false);
    }
  };

  const cardBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
  const cardBg = isDark ? 'rgba(255,255,255,0.05)' : '#ffffff';
  const dividerColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';

  // 🌟 OBLICZENIA DLA EFEKTU "HYPER-DRIVE" 🌟
  const scale = warpAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [1, 0.85, 3] 
  });

  const rotateX = warpAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: ['0deg', '-12deg', '0deg']
  });

  const rotateY = warpAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: ['0deg', '0deg', '180deg']
  });

  const opacity = warpAnim.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [1, 1, 0]
  });

  const FormShell = embedded ? View : Animated.View;
  const formShellStyle: StyleProp<ViewStyle> = embedded
    ? { flex: 1 }
    : {
        flex: 1,
        opacity,
        transform: [
          { perspective: 850 },
          { scale },
          { rotateX },
          { rotateY },
        ],
        elevation: 20,
        backfaceVisibility: 'hidden',
      };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme.background }}>
      
      <FormShell style={formShellStyle}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 25, paddingTop: Platform.OS === 'ios' ? 80 : 50, paddingBottom: 50 }}>
          
          <View style={[styles.iconWrapper, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Ionicons
              name={isLogin ? 'lock-closed' : 'person-add'}
              size={45}
              color={isLogin ? '#10b981' : role === 'AGENT' ? '#FF9F0A' : '#10b981'}
            />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>{isLogin ? t('auth.welcomeBack') : t('auth.createCard')}</Text>
          
          {!isLogin && (
            <View style={{ marginBottom: 25 }}>
              <View style={[styles.roleSwitchContainer, { backgroundColor: cardBg, borderWidth: 1, borderColor: cardBorder }]}>
                <Pressable
                  onPress={() => { Haptics.selectionAsync(); setRole('PRIVATE'); }}
                  style={[styles.roleButton, role === 'PRIVATE' && styles.roleButtonActivePrivate]}
                >
                  <Text style={[styles.roleText, { color: role === 'PRIVATE' ? '#FFF' : theme.subtitle }]}>
                    {t('auth.rolePrivate')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => { Haptics.selectionAsync(); setRole('AGENT'); }}
                  style={[styles.roleButton, role === 'AGENT' && styles.roleButtonActiveAgent]}
                >
                  <Text style={[styles.roleText, { color: role === 'AGENT' ? '#FFF' : theme.subtitle }]}>
                    {t('auth.roleAgent')}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {!isLogin && (
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={styles.inputRow}>
                <TextInput style={[styles.input, { color: theme.text, flex: 1 }]} placeholder={t('auth.firstName')} placeholderTextColor={theme.subtitle} value={firstName} onChangeText={setFirstName} />
              </View>
              <View style={[styles.divider, { backgroundColor: dividerColor }]} />
              <View style={styles.inputRow}>
                <TextInput style={[styles.input, { color: theme.text, flex: 1 }]} placeholder={t('auth.lastName')} placeholderTextColor={theme.subtitle} value={lastName} onChangeText={setLastName} />
              </View>
              {/*
                Pole „Nazwa firmy" pojawia się TYLKO dla roli AGENT —
                między nazwiskiem a telefonem, żeby formularz wizytówki
                czytał się jak naturalna kolejność „Kto + Skąd". Dla
                osoby prywatnej pole nie istnieje w drzewie (nie miga
                opacity, więc nie ma layout-shake).
              */}
              {role === 'AGENT' && (
                <>
                  <View style={[styles.divider, { backgroundColor: dividerColor }]} />
                  <View style={styles.inputRow}>
                    <Ionicons
                      name="business"
                      size={18}
                      color="#FF9F0A"
                      style={{ marginRight: 10 }}
                    />
                    <TextInput
                      style={[styles.input, { color: theme.text, flex: 1 }]}
                      placeholder={t('auth.agencyName')}
                      placeholderTextColor={theme.subtitle}
                      value={companyName}
                      onChangeText={setCompanyName}
                      autoCapitalize="words"
                      maxLength={80}
                    />
                  </View>
                </>
              )}
              <View style={[styles.divider, { backgroundColor: dividerColor }]} />
              <View style={styles.inputRow}>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    setPhonePickerOpen(true);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', marginRight: 10, paddingVertical: 4, paddingHorizontal: 6, borderRadius: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }}
                >
                  <Text style={{ fontSize: 22, marginRight: 6 }}>{flagEmojiFromIso2(phoneCountryIso)}</Text>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>+{dialCodeFor(phoneCountryIso)}</Text>
                  <Ionicons name="chevron-down" size={16} color={theme.subtitle} style={{ marginLeft: 4 }} />
                </Pressable>
                <TextInput style={[styles.input, { color: theme.text, flex: 1 }]} placeholder={t('auth.phoneNumber')} placeholderTextColor={theme.subtitle} keyboardType="numeric" value={phone} onChangeText={handlePhoneChange} />
                <StatusIcon status={phoneStatus} />
              </View>
            </View>
          )}

          <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder, marginTop: isLogin ? 0 : 15 }]}>
            <View style={styles.inputRow}>
              <TextInput style={[styles.input, { color: theme.text, flex: 1 }]} placeholder={t('auth.email')} autoCapitalize="none" keyboardType="email-address" placeholderTextColor={theme.subtitle} value={email} onChangeText={setEmail} />
              {!isLogin && <StatusIcon status={emailStatus} />}
            </View>
            <View style={[styles.divider, { backgroundColor: dividerColor }]} />
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { color: theme.text, flex: 1 }]}
                placeholder={t('auth.password')}
                secureTextEntry={!passwordVisible}
                placeholderTextColor={theme.subtitle}
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <PasswordEyeToggle
                revealed={passwordVisible}
                onToggle={() => setPasswordVisible((v) => !v)}
                iconColor={theme.subtitle}
                a11yHide={t('auth.hidePassword')}
                a11yShow={t('auth.showPassword')}
              />
            </View>
          </View>

          {isLogin && (
            <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setIsForgotModalVisible(true); }} style={{ alignSelf: 'flex-end', marginTop: 15 }}>
              <Text style={{ color: theme.subtitle, fontSize: 13, fontWeight: '600' }}>{t('auth.forgotPassword')}</Text>
            </Pressable>
          )}

          {!isLogin && (
            <PremiumCheckbox 
              checked={termsAccepted} 
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTermsAccepted(!termsAccepted); }}
              onReadTerms={() => { Haptics.selectionAsync(); navigation.navigate('Terms'); }}
              onReadPrivacy={() => { Haptics.selectionAsync(); navigation.navigate('Terms', { initialScrollTo: 'privacy' }); }}
              theme={theme}
              t={t}
            />
          )}

          <Pressable onPress={handleSubmit} style={({ pressed }) => [
              styles.mainButton, 
              { opacity: pressed ? 0.8 : 1, backgroundColor: isLogin ? '#10b981' : (role === 'AGENT' ? '#FF9F0A' : '#10b981') },
              !isLogin && role === 'AGENT' && { shadowColor: '#FF9F0A' }
            ]}>
            <Text style={styles.mainButtonText}>{isLogin ? t('auth.login') : t('auth.joinEcosystem')}</Text>
          </Pressable>

          {isLogin && (
            <View style={styles.passkeySection}>
              <View style={styles.dividerRow}>
                <View style={[styles.line, { backgroundColor: dividerColor }]} />
                <Text style={{ color: theme.subtitle, paddingHorizontal: 15, fontSize: 12, fontWeight: '700' }}>{t('auth.orDivider')}</Text>
                <View style={[styles.line, { backgroundColor: dividerColor }]} />
              </View>

              <Pressable onPress={handlePasskey} style={({ pressed }) => [styles.passkeyBtn, { backgroundColor: cardBg, borderColor: cardBorder }, pressed && { opacity: 0.6 }]}>
                {isPasskeyLoading ? <ActivityIndicator size="small" color={theme.text} /> : (
                  <>
                    <Ionicons name="finger-print" size={24} color={theme.text} style={{ marginRight: 12 }} />
                    <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>{t('auth.passkeyFaceId')}</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}

          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setIsLogin(!isLogin); }} style={{ marginTop: 25, alignItems: 'center' }}>
            <Text style={{ color: theme.subtitle, fontSize: 15 }}>
              {isLogin ? `${t('auth.noAccount')} ` : `${t('auth.haveAccount')} `}
              <Text style={{ color: isLogin ? '#10b981' : (role === 'AGENT' ? '#FF9F0A' : '#10b981'), fontWeight: '700' }}>
                {isLogin ? t('auth.registerLink') : t('auth.loginLink')}
              </Text>
            </Text>
          </Pressable>

        </ScrollView>
      </FormShell>
      <PhoneCountryPickerModal
        visible={phonePickerOpen}
        onClose={() => setPhonePickerOpen(false)}
        selectedIso={phoneCountryIso}
        onSelect={setPhoneCountryIso}
        isDark={isDark}
      />
      <ForgotPasswordModal visible={isForgotModalVisible} onClose={() => setIsForgotModalVisible(false)} theme={theme} t={t} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  iconWrapper: { width: 80, height: 80, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 25, alignSelf: 'center', borderWidth: 1 },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center', marginBottom: 30, letterSpacing: -0.5 },
  roleSwitchContainer: { flexDirection: 'row', borderRadius: 16, padding: 4 },
  roleButton: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
  roleText: { fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  roleButtonActivePrivate: { backgroundColor: '#10b981', shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4 },
  /**
   * Aktywny przycisk roli „Agent" — bursztynowy (Apple Orange / FF9F0A),
   * świadomie inny od zielonego dla Osoby prywatnej. Ten sam akcent
   * przejmuje submit-button przy AGENT, żeby cały formularz miał spójny
   * „business-tone".
   */
  roleButtonActiveAgent: { backgroundColor: '#FF9F0A', shadowColor: '#FF9F0A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 4 },
  card: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 18 },
  input: { fontSize: 17, fontWeight: '600' },
  divider: { height: 1, marginHorizontal: 20 },
  mainButton: { padding: 20, borderRadius: 20, alignItems: 'center', marginTop: 15, shadowColor: '#10b981', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 5 },
  mainButtonText: { color: '#FFF', fontSize: 17, fontWeight: '800' },
  checkboxContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 25, paddingHorizontal: 5 },
  checkboxTouchArea: { padding: 5, marginRight: 10 },
  checkboxBox: { width: 24, height: 24, borderRadius: 8, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  checkboxTextContainer: { flex: 1 },
  checkboxText: { fontSize: 13, lineHeight: 20 },
  passkeySection: { marginTop: 25 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
  line: { flex: 1, height: 1 },
  passkeyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, borderRadius: 20, borderWidth: 1 }
});

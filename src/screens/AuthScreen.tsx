import { useNavigation } from "@react-navigation/native";
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView, Animated, Modal, Easing } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

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
}: {
  revealed: boolean;
  onToggle: () => void;
  iconColor: string;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onToggle();
      }}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      accessibilityRole="button"
      accessibilityLabel={revealed ? 'Ukryj hasło' : 'Pokaż hasło'}
    >
      <Ionicons name={revealed ? 'eye-off-outline' : 'eye-outline'} size={22} color={iconColor} />
    </Pressable>
  );
}

// --- ANIMOWANY CHECKBOX Z EFEKTEM GLOW ---
const PremiumCheckbox = ({ checked, onPress, onReadTerms, theme }: any) => {
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
          Oświadczam, że zapoznałem się z{' '}
          <Text onPress={onReadTerms} style={{ color: theme.text, fontWeight: '700', textDecorationLine: 'underline' }}>Regulaminem</Text>
          {' '}i akceptuję jego warunki.
        </Text>
      </View>
    </View>
  );
};

// --- MODAL: RESET HASŁA ---
const ForgotPasswordModal = ({ visible, onClose, theme }: any) => {
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
    if (!email.includes('@')) return Alert.alert("Błąd", "Wpisz poprawny adres e-mail.");
    setLoading(true);
    try {
      const res = await fetch('https://estateos.pl/api/auth/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: email })
      });
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setStep(2);
      } else {
        const d = await res.json();
        Alert.alert("Błąd", d.message || "Użytkownik nie istnieje.");
      }
    } catch { Alert.alert("Błąd", "Brak połączenia z serwerem."); }
    setLoading(false);
  };

  const handleFinalReset = async () => {
    if (otp.length < 4) return Alert.alert("Błąd", "Wpisz kod z e-maila.");
    if (newPassword.length < 6) return Alert.alert("Błąd", "Nowe hasło musi mieć min. 6 znaków.");
    
    setLoading(true);
    try {
      const res = await fetch('https://estateos.pl/api/auth/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ identifier: email, otp, newPassword })
      });
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Sukces!", "Hasło zmienione. Możesz się zalogować.", [{ text: "Super", onPress: onClose }]);
      } else {
        Alert.alert("Błąd", "Kod jest nieprawidłowy lub wygasł.");
      }
    } catch { Alert.alert("Błąd", "Problem z resetowaniem."); }
    setLoading(false);
  };

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="overFullScreen" transparent={true}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 }}>
        <View style={{ backgroundColor: theme.background, borderRadius: 30, padding: 25, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>{step === 1 ? 'Resetuj przez Email' : 'Ustaw nowe hasło'}</Text>
            <Pressable onPress={onClose}><Ionicons name="close-circle" size={28} color={theme.subtitle} /></Pressable>
          </View>
          {step === 1 ? (
            <View>
              <Text style={{ color: theme.subtitle, marginBottom: 20, fontSize: 14 }}>Wyślemy Ci wiadomość e-mail z jednorazowym kodem weryfikacyjnym.</Text>
              <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                <View style={styles.inputRow}>
                  <TextInput style={[styles.input, { color: theme.text, flex: 1 }]} placeholder="Twój e-mail" autoCapitalize="none" keyboardType="email-address" placeholderTextColor={theme.subtitle} value={email} onChangeText={setEmail} />
                </View>
              </View>
              <Pressable onPress={handleSendEmailCode} style={[styles.mainButton, { backgroundColor: '#10b981', marginTop: 20 }]}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.mainButtonText}>Wyślij kod</Text>}
              </Pressable>
            </View>
          ) : (
            <View>
              <Text style={{ color: theme.subtitle, marginBottom: 15, fontSize: 14 }}>Wpisz kod z e-maila oraz nowe hasło.</Text>
              <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                <View style={styles.inputRow}>
                  <Ionicons name="mail-open-outline" size={20} color={theme.subtitle} style={{marginRight: 10}} />
                  <TextInput style={[styles.input, { color: theme.text, flex: 1 }]} placeholder="Kod (np. 1234)" keyboardType="numeric" placeholderTextColor={theme.subtitle} value={otp} onChangeText={setOtp} />
                </View>
                <View style={[styles.divider, { backgroundColor: cardBorder }]} />
                <View style={styles.inputRow}>
                  <Ionicons name="key-outline" size={20} color={theme.subtitle} style={{ marginRight: 10 }} />
                  <TextInput
                    style={[styles.input, { color: theme.text, flex: 1 }]}
                    placeholder="Nowe hasło"
                    secureTextEntry={!newPasswordVisible}
                    placeholderTextColor={theme.subtitle}
                    value={newPassword}
                    onChangeText={setNewPassword}
                  />
                  <PasswordEyeToggle
                    revealed={newPasswordVisible}
                    onToggle={() => setNewPasswordVisible((v) => !v)}
                    iconColor={theme.subtitle}
                  />
                </View>
              </View>
              <Pressable onPress={handleFinalReset} style={[styles.mainButton, { backgroundColor: '#10b981', marginTop: 20 }]}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.mainButtonText}>Zmień hasło</Text>}
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
}: {
  theme: any;
  /** Z nawigacji (np. gość z oferty): który formularz pokazać od razu. */
  authIntent?: 'login' | 'register';
}) {
  const navigation = useNavigation<any>();
  const [isLogin, setIsLogin] = useState(() => (authIntent === 'register' ? false : true));
  const [isForgotModalVisible, setIsForgotModalVisible] = useState(false);
  const [role, setRole] = useState<'PRIVATE' | 'PARTNER'>('PRIVATE');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  const [emailStatus, setEmailStatus] = useState<'idle' | 'loading' | 'available' | 'taken'>('idle');
  const [phoneStatus, setPhoneStatus] = useState<'idle' | 'loading' | 'available' | 'taken'>('idle');
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);

  const store = useAuthStore() as any;
  const isDark = theme.glass === 'dark';

  // 🚀 ZJAWISKOWA ANIMACJA HYPER-DRIVE 🚀
  const warpAnim = useRef(new Animated.Value(0)).current;
  const successGlowAnim = useRef(new Animated.Value(0)).current;

  const handlePhoneChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '').substring(0, 9);
    const parts = cleaned.match(/.{1,3}/g);
    setPhone(parts ? parts.join(' ') : cleaned);
  };

  useEffect(() => {
    if (isLogin || email.length < 5 || !email.includes('@')) { setEmailStatus('idle'); return; }
    const timer = setTimeout(async () => {
      setEmailStatus('loading');
      try {
        const res = await fetch('https://estateos.pl/api/auth/check-exists', {
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
    const cleanPhone = phone.replace(/\s/g, '');
    if (isLogin || cleanPhone.length < 9) { setPhoneStatus('idle'); return; }
    const timer = setTimeout(async () => {
      setPhoneStatus('loading');
      try {
        const res = await fetch('https://estateos.pl/api/auth/check-exists', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '+48 ' + cleanPhone, field: 'phone', value: '+48 ' + cleanPhone })
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
  }, [phone, isLogin]);

  useEffect(() => {
    setPasswordVisible(false);
  }, [isLogin]);

  useEffect(() => {
    if (authIntent === 'register') setIsLogin(false);
    else if (authIntent === 'login') setIsLogin(true);
  }, [authIntent]);

  const handleSubmit = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if (isLogin) {
        const normalizedEmail = String(email || '').trim().toLowerCase();
        const normalizedPassword = String(password || '');
        const ok = await store.login(normalizedEmail, normalizedPassword);
        if (!ok) {
          Alert.alert('Błąd logowania', store.error || 'Nieprawidłowy e-mail lub hasło.');
          return;
        }
      } else {
        if (!firstName || !lastName || phone.replace(/\s/g, '').length < 9) {
          Alert.alert("Błąd", "Wypełnij poprawnie wizytówkę."); return;
        }
        if (emailStatus === 'taken') { Alert.alert("Błąd", "Ten adres e-mail jest już zarejestrowany."); return; }
        if (phoneStatus === 'taken') { Alert.alert("Błąd", "Ten numer telefonu jest już używany."); return; }
        
        if (!termsAccepted) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert("Wymagany Regulamin", "Proszę zapoznać się z regulaminem i zaakceptować jego warunki przed dołączeniem do platformy.");
          return;
        }

        const isRegistered = await store.register(email, password, firstName, lastName, '+48 ' + phone.replace(/\s/g, ''), role);
        
        if (isRegistered) {
          const isLogged = await store.login(email, password);
          if (isLogged) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            // Od razu po rejestracji wysyłamy kod weryfikacyjny na podany e-mail (jeśli backend wspiera).
            const verifySend = await store
              .sendCurrentEmailVerification()
              .catch(() => ({ ok: false, error: 'Wysyłka kodu nieudana.' } as { ok: boolean; error?: string }));
            const verifiedMsg = verifySend?.ok
              ? `Wysłaliśmy 6-cyfrowy kod weryfikacyjny na ${email}.\nOtwórz skrzynkę i potwierdź adres w „Profil → Edytuj dane”.\n\nDodatkowo zweryfikuj numer telefonu (SMS), aby odblokować wszystkie funkcje.`
              : `Witamy w gronie EstateOS™!\n\nZweryfikuj swój numer telefonu (SMS) oraz adres e-mail w profilu, aby odblokować wszystkie funkcje.`;
            Alert.alert(
              "Konto pomyślnie założone!",
              verifiedMsg,
              [{ text: "Rozumiem", style: "default" }]
            );
          } else {
            Alert.alert("Sukces", "Konto założone! Zaloguj się swoimi danymi.");
            setIsLogin(true);
          }
        }
      }
    } catch (e: any) { Alert.alert('Błąd', e.message); }
  };

  // 🔥 MISTRZOWSKA OBSŁUGA PASSKEY Z EFEKTEM 3D 🔥
  const handlePasskey = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); 
    setIsPasskeyLoading(true);
    
    try { 
      // 1. Oczekujemy na weryfikację Face ID. Store obsłuży dane i token, w ciszy.
      const success = await store.loginWithPasskey(); 

      if (success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        // 2. KINOWA SEKWENCJA ANIMACJI
        Animated.sequence([
          // Faza 1: Zapalenie zielonej aury sukcesu
          Animated.timing(successGlowAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: false,
          }),
          // Faza 2: Skok w nadprzestrzeń (Warp) - pełny obrót o 180 stopni
          Animated.timing(warpAnim, {
            toValue: 1,
            duration: 850,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            useNativeDriver: true,
          })
        ]).start(() => {
          // 3. Po zakończeniu 3D przenosimy prosto i bezbłędnie do profilu
          navigation.navigate('Profil'); 
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
        Alert.alert(
          'Nie udało się zalogować',
          'Spróbuj ponownie albo zaloguj się e-mailem i hasłem.',
        );
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

  const glowShadow = successGlowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0,0,0,0)', 'rgba(16, 185, 129, 0.6)']
  });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme.background }}>
      
      {/* KONTENER ANIMACJI NADPRZESTRZENNEJ */}
      <Animated.View 
        style={{ 
          flex: 1,
          opacity,
          transform: [
            { perspective: 850 }, 
            { scale },
            { rotateX },
            { rotateY }
          ],
          shadowColor: glowShadow,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: successGlowAnim,
          shadowRadius: 50,
          elevation: 20,
          backfaceVisibility: 'hidden'
        }}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 25, paddingTop: Platform.OS === 'ios' ? 80 : 50, paddingBottom: 50 }}>
          
          <View style={[styles.iconWrapper, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Ionicons name={isLogin ? "lock-closed" : "person-add"} size={45} color={isLogin ? "#10b981" : (role === 'PARTNER' ? "#FF9F0A" : "#10b981")} />
          </View>
          <Text style={[styles.title, { color: theme.text }]}>{isLogin ? 'Witaj ponownie' : 'Stwórz Wizytówkę'}</Text>
          
          {!isLogin && (
            <View style={{ marginBottom: 25 }}>
              <View style={[styles.roleSwitchContainer, { backgroundColor: cardBg, borderWidth: 1, borderColor: cardBorder }]}>
                <Pressable onPress={() => { Haptics.selectionAsync(); setRole('PRIVATE'); }} style={[styles.roleButton, role === 'PRIVATE' && styles.roleButtonActivePrivate]}>
                  <Text style={[styles.roleText, { color: role === 'PRIVATE' ? '#FFF' : theme.subtitle }]}>Osoba prywatna</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    Alert.alert(
                      'Partner EstateOS™',
                      'Ta opcja będzie dostępna wkrótce.',
                      [{ text: 'OK', onPress: () => setRole('PRIVATE') }]
                    );
                  }}
                  style={[styles.roleButton, role === 'PARTNER' && styles.roleButtonActivePartner]}
                >
                  <Text style={[styles.roleText, { color: role === 'PARTNER' ? '#FFF' : theme.subtitle }]}>Partner EstateOS™</Text>
                </Pressable>
              </View>
            </View>
          )}

          {!isLogin && (
            <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={styles.inputRow}>
                <TextInput style={[styles.input, { color: theme.text, flex: 1 }]} placeholder="Imię" placeholderTextColor={theme.subtitle} value={firstName} onChangeText={setFirstName} />
              </View>
              <View style={[styles.divider, { backgroundColor: dividerColor }]} />
              <View style={styles.inputRow}>
                <TextInput style={[styles.input, { color: theme.text, flex: 1 }]} placeholder="Nazwisko" placeholderTextColor={theme.subtitle} value={lastName} onChangeText={setLastName} />
              </View>
              <View style={[styles.divider, { backgroundColor: dividerColor }]} />
              <View style={styles.inputRow}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: theme.subtitle, marginRight: 8 }}>+48</Text>
                <TextInput style={[styles.input, { color: theme.text, flex: 1 }]} placeholder="000 000 000" placeholderTextColor={theme.subtitle} keyboardType="numeric" value={phone} onChangeText={handlePhoneChange} />
                <StatusIcon status={phoneStatus} />
              </View>
            </View>
          )}

          <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder, marginTop: isLogin ? 0 : 15 }]}>
            <View style={styles.inputRow}>
              <TextInput style={[styles.input, { color: theme.text, flex: 1 }]} placeholder="Email" autoCapitalize="none" keyboardType="email-address" placeholderTextColor={theme.subtitle} value={email} onChangeText={setEmail} />
              {!isLogin && <StatusIcon status={emailStatus} />}
            </View>
            <View style={[styles.divider, { backgroundColor: dividerColor }]} />
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { color: theme.text, flex: 1 }]}
                placeholder="Hasło"
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
              />
            </View>
          </View>

          {isLogin && (
            <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setIsForgotModalVisible(true); }} style={{ alignSelf: 'flex-end', marginTop: 15 }}>
              <Text style={{ color: theme.subtitle, fontSize: 13, fontWeight: '600' }}>Nie pamiętasz hasła?</Text>
            </Pressable>
          )}

          {!isLogin && (
            <PremiumCheckbox 
              checked={termsAccepted} 
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTermsAccepted(!termsAccepted); }}
              onReadTerms={() => { Haptics.selectionAsync(); navigation.navigate('Terms'); }}
              theme={theme}
            />
          )}

          <Pressable onPress={handleSubmit} style={({ pressed }) => [
              styles.mainButton, 
              { opacity: pressed ? 0.8 : 1, backgroundColor: isLogin ? '#10b981' : (role === 'PARTNER' ? '#FF9F0A' : '#10b981') },
              !isLogin && role === 'PARTNER' && { shadowColor: '#FF9F0A' }
            ]}>
            <Text style={styles.mainButtonText}>{isLogin ? 'Zaloguj się' : 'Dołącz do ekosystemu EstateOS™'}</Text>
          </Pressable>

          {isLogin && (
            <View style={styles.passkeySection}>
              <View style={styles.dividerRow}>
                <View style={[styles.line, { backgroundColor: dividerColor }]} />
                <Text style={{ color: theme.subtitle, paddingHorizontal: 15, fontSize: 12, fontWeight: '700' }}>LUB</Text>
                <View style={[styles.line, { backgroundColor: dividerColor }]} />
              </View>

              <Pressable onPress={handlePasskey} style={({ pressed }) => [styles.passkeyBtn, { backgroundColor: cardBg, borderColor: cardBorder }, pressed && { opacity: 0.6 }]}>
                {isPasskeyLoading ? <ActivityIndicator size="small" color={theme.text} /> : (
                  <>
                    <Ionicons name="finger-print" size={24} color={theme.text} style={{ marginRight: 12 }} />
                    <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>Zaloguj się z Face ID</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}

          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setIsLogin(!isLogin); }} style={{ marginTop: 25, alignItems: 'center' }}>
            <Text style={{ color: theme.subtitle, fontSize: 15 }}>
              {isLogin ? 'Nie masz konta? ' : 'Masz już konto? '}
              <Text style={{ color: isLogin ? '#10b981' : (role === 'PARTNER' ? '#FF9F0A' : '#10b981'), fontWeight: '700' }}>
                {isLogin ? 'Zarejestruj się' : 'Zaloguj się'}
              </Text>
            </Text>
          </Pressable>

        </ScrollView>
      </Animated.View>
      <ForgotPasswordModal visible={isForgotModalVisible} onClose={() => setIsForgotModalVisible(false)} theme={theme} />
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
  roleButtonActivePartner: { backgroundColor: '#FF9F0A', shadowColor: '#FF9F0A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 4 },
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

import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Platform, KeyboardAvoidingView, ActivityIndicator, Animated, useColorScheme } from 'react-native';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore, persistLocalPhoneVerified } from '../store/useAuthStore';
import { API_URL } from '../config/network';

export default function SmsVerificationScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const { fromRegister } = route.params || {};
  const themeMode = useThemeStore(s => s.themeMode);
  const systemScheme = useColorScheme();
  const isDark = themeMode === 'dark' || (themeMode === 'auto' && systemScheme === 'dark');
  
  const store = useAuthStore() as any;
  const user = store.user;
  
  const bgColor = isDark ? '#000000' : '#f5f5f7';
  const textColor = isDark ? '#ffffff' : '#1d1d1f';
  const subColor = isDark ? '#86868b' : '#86868b';
  
  const [code, setCode] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Anti-Spam States
  const [resendTimer, setResendTimer] = useState(0); 
  const [smsCount, setSmsCount] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);

  const inputRefs = [useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null)];

  // 1. INICJALIZACJA PAMIĘCI ANTY-SPAMOWEJ
  useEffect(() => {
    const initSpamControl = async () => {
      if (!user?.id) return;
      const countKey = `@sms_count_${user.id}`;
      const timeKey = `@sms_time_${user.id}`;

      const storedCount = await AsyncStorage.getItem(countKey);
      const storedTime = await AsyncStorage.getItem(timeKey);

      let currentCount = storedCount ? parseInt(storedCount) : 0;
      let lastTime = storedTime ? parseInt(storedTime) : 0;
      const now = Math.floor(Date.now() / 1000);
      const timePassed = now - lastTime;

      if (currentCount >= 2) {
        if (timePassed < 3600) {
          setResendTimer(3600 - timePassed);
        } else {
          setIsBlocked(true); // Limit wyczerpany
        }
        setSmsCount(2);
      } else if (currentCount === 1) {
        if (timePassed < 300) {
          setResendTimer(300 - timePassed);
        } else {
          setResendTimer(0);
        }
        setSmsCount(1);
      } else {
        // Pierwsze wejście - wysyłamy od razu i dajemy 5 min blokady
        triggerSmsSend(1);
      }
    };
    initSpamControl();
  }, []);

  // 2. ODLICZANIE CZASU
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    } else if (resendTimer === 0 && smsCount >= 2) {
       // Jeśli minęła godzina blokady 2 SMSa, permanentnie blokujemy na "Kontakt z adminem"
       setIsBlocked(true);
    }
    return () => clearInterval(interval);
  }, [resendTimer, smsCount]);

  // 3. AUTO-WERYFIKACJA PO UZUPEŁNIENIU 4 CYFR
  useEffect(() => {
    if (code.every(c => c.length === 1) && !loading) {
      handleVerify(code.join(''));
    }
  }, [code]);

  const triggerSmsSend = async (newCount: number) => {
    if (newCount > 2) return;

    setSmsCount(newCount);
    const timerValue = newCount === 1 ? 300 : 3600; // 5 minut dla 1, godzina dla 2
    setResendTimer(timerValue);

    const now = Math.floor(Date.now() / 1000);
    await AsyncStorage.setItem(`@sms_count_${user.id}`, newCount.toString());
    await AsyncStorage.setItem(`@sms_time_${user.id}`, now.toString());

    try {
      await fetch(`${API_URL}/api/mobile/v1/auth/sms/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      if (__DEV__) console.warn('Błąd wysyłki SMS', e);
    }
  };

  const handleType = (text: string, index: number) => {
    setErrorMsg('');
    
    // MAGIA AUTO-UZUPEŁNIANIA Z iOS/ANDROID: Jeśli system wklei cały 4-cyfrowy kod naraz
    if (text.length === 4) {
      const splitCode = text.split('');
      setCode(splitCode);
      inputRefs[3].current?.focus();
      return;
    }

    // Normalne wpisywanie pojedynczej cyfry
    const newCode = [...code];
    newCode[index] = text.replace(/[^0-9]/g, '');
    setCode(newCode);
    
    if (text && index < 3) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handleVerify = async (finalCodeParam?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setErrorMsg('');
    
    const finalCode = finalCodeParam || code.join('');

    try {
      const res = await fetch(`${API_URL}/api/mobile/v1/auth/sms/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, code: finalCode })
      });
      
      const data = await res.json();

      if (res.ok && data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Trwały lokalny ślad — jeśli backend nie zwróci `phoneVerified` w `/me`,
        // apka i tak utrzyma status między sesjami.
        if (user?.id != null) await persistLocalPhoneVerified(user.id, true);

        const updatedUser = { ...user, isVerified: true, isVerifiedPhone: true };
        useAuthStore.setState({ user: updatedUser });
        await AsyncStorage.setItem('user_data', JSON.stringify(updatedUser));

        if (fromRegister) {
          navigation.replace("MainTabs", { screen: "Profil" });
        } else {
          navigation.goBack();
        }
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setErrorMsg(data.message || 'Nieprawidłowy kod');
        setCode(['', '', '', '']);
        inputRefs[0].current?.focus();
      }
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setErrorMsg('Brak połączenia z serwerem');
    }
    setLoading(false);
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (fromRegister) {
      navigation.replace("MainTabs", { screen: "Profil" });
    } else {
      navigation.goBack();
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isFull = code.every(c => c.length === 1);
  const hasError = errorMsg.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <BlurView intensity={80} tint={isDark ? "dark" : "light"} style={styles.header}>
        <View style={styles.notch} />
        <Text style={[styles.headerTitle, { color: textColor }]}>Weryfikacja SMS</Text>
      </BlurView>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="chatbubble-ellipses" size={40} color="#10b981" />
        </View>
        <Text style={[styles.title, { color: textColor }]}>Wprowadź kod</Text>
        <Text style={[styles.subtitle, { color: subColor }]}>
          Wysłaliśmy 4-cyfrowy kod na Twój numer: {"\n"}
          <Text style={{ fontWeight: '700', color: textColor }}>{user?.phone || 'Twój numer'}</Text>
        </Text>

        <View style={styles.otpContainer}>
          {code.map((digit, idx) => (
            <TextInput
              key={idx}
              ref={inputRefs[idx]}
              style={[
                styles.otpBox, 
                { color: hasError ? '#ef4444' : textColor, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff', borderColor: hasError ? '#ef4444' : (digit ? '#10b981' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')) },
                digit && !hasError ? styles.otpBoxFilled : null
              ]}
              keyboardType="number-pad"
              maxLength={4} // Zwiększone dla wklejania całości naraz
              value={digit}
              onChangeText={(t) => handleType(t, idx)}
              onKeyPress={(e) => handleKeyPress(e, idx)}
              selectionColor="#10b981"
              textContentType="oneTimeCode" // Wymuszenie klawiatury z SMS dla iOS
              autoComplete="sms-otp" // Wymuszenie podpowiedzi z SMS dla Android
            />
          ))}
        </View>

        {hasError && <Text style={styles.errorText}>{errorMsg}</Text>}

        <Pressable 
          disabled={!isFull || loading} 
          onPress={() => handleVerify()} 
          style={({pressed}) => [styles.verifyBtn, { opacity: (!isFull ? 0.5 : (pressed ? 0.8 : 1)) }]}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.verifyText}>Zweryfikuj</Text>}
        </Pressable>

        {isBlocked ? (
           <Text style={[styles.resendText, { color: '#ef4444', textAlign: 'center', marginTop: 10, paddingHorizontal: 20 }]}>
             Wykorzystano limit kodów SMS. Skontaktuj się z administratorem EstateOS.
           </Text>
        ) : (
          <Pressable 
            disabled={resendTimer > 0}
            onPress={() => triggerSmsSend(smsCount + 1)} 
            style={styles.resendBtn}
          >
            <Text style={[styles.resendText, { color: resendTimer > 0 ? subColor : '#10b981' }]}>
              {resendTimer > 0 ? `Wyślij ponownie za ${formatTime(resendTimer)}` : 'Wyślij nowy kod'}
            </Text>
          </Pressable>
        )}

        <View style={{ flex: 1 }} />

        <Pressable onPress={handleSkip} style={styles.skipBtn}>
          <Text style={[styles.skipText, { color: subColor }]}>Zweryfikuj później</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: Platform.OS === 'ios' ? 15 : 20, paddingBottom: 15, alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: 'rgba(150,150,150,0.2)', zIndex: 10 },
  notch: { width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(150,150,150,0.4)', marginBottom: 15 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  content: { flex: 1, padding: 25, alignItems: 'center', marginTop: 20 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(16, 185, 129, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 26, fontWeight: '800', marginBottom: 10, letterSpacing: 0.5 },
  subtitle: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 40, paddingHorizontal: 10 },
  otpContainer: { flexDirection: 'row', gap: 15, marginBottom: 15 },
  otpBox: { width: 60, height: 70, borderRadius: 16, borderWidth: 1.5, fontSize: 28, fontWeight: '700', textAlign: 'center' },
  otpBoxFilled: { shadowColor: '#10b981', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  errorText: { color: '#ef4444', fontSize: 14, fontWeight: '600', marginBottom: 25 },
  verifyBtn: { width: '100%', backgroundColor: '#10b981', padding: 18, borderRadius: 20, alignItems: 'center', shadowColor: '#10b981', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 5, marginBottom: 25 },
  verifyText: { color: '#ffffff', fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
  resendBtn: { padding: 10 },
  resendText: { fontSize: 14, fontWeight: '700' },
  skipBtn: { padding: 15, marginBottom: 20 },
  skipText: { fontSize: 15, fontWeight: '600' }
});

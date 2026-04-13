import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Platform, KeyboardAvoidingView, ActivityIndicator, Alert, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useThemeStore } from '../store/useThemeStore';
import { useAuthStore } from '../store/useAuthStore';

export default function SmsVerificationScreen({ route }: any) {
  const navigation = useNavigation<any>();
  const { fromRegister } = route.params || {};
  const themeMode = useThemeStore(s => s.themeMode);
  const isDark = themeMode === 'dark';
  
  // Wyciągamy dane użytkownika i możliwość nadpisania stanu sklepu
  const store = useAuthStore() as any;
  const user = store.user;
  
  const bgColor = isDark ? '#000000' : '#f5f5f7';
  const textColor = isDark ? '#ffffff' : '#1d1d1f';
  const subColor = isDark ? '#86868b' : '#86868b';
  
  const [code, setCode] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [resendTimer, setResendTimer] = useState(60); // 60 sekund blokady na kolejny SMS

  const inputRefs = [useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null), useRef<TextInput>(null)];

  // 1. AUTOMATYCZNA WYSYŁKA SMS PRZY OTWARCIU EKRANU
  useEffect(() => {
    if (user?.id) {
      triggerSmsSend();
    }
  }, []);

  // 2. ODLICZANIE CZASU (TIMER ANTY-SPAMOWY)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // 3. AUTO-WERYFIKACJA PO WPISANIU 4 CYFR
  useEffect(() => {
    if (code.every(c => c.length === 1)) {
      handleVerify();
    }
  }, [code]);

  const triggerSmsSend = async () => {
    try {
      setResendTimer(60);
      await fetch('https://estateos.pl/api/mobile/v1/auth/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.log("Błąd wysyłki SMS", e);
    }
  };

  const handleType = (text: string, index: number) => {
    setErrorMsg(''); // Czyścimy błąd po wpisaniu nowej cyfry
    const newCode = [...code];
    newCode[index] = text;
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

  const handleVerify = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    setErrorMsg('');
    
    const finalCode = code.join('');

    try {
      const res = await fetch('https://estateos.pl/api/mobile/v1/auth/sms/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, code: finalCode })
      });
      
      const data = await res.json();

      if (res.ok && data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        // Magia! Zmieniamy status użytkownika "w locie", by plakietka w profilu od razu zniknęła
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
              maxLength={1}
              value={digit}
              onChangeText={(t) => handleType(t, idx)}
              onKeyPress={(e) => handleKeyPress(e, idx)}
              selectionColor="#10b981"
            />
          ))}
        </View>

        {hasError && <Text style={styles.errorText}>{errorMsg}</Text>}

        <Pressable 
          disabled={!isFull || loading} 
          onPress={handleVerify} 
          style={({pressed}) => [styles.verifyBtn, { opacity: (!isFull ? 0.5 : (pressed ? 0.8 : 1)) }]}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.verifyText}>Zweryfikuj</Text>}
        </Pressable>

        <Pressable 
          disabled={resendTimer > 0}
          onPress={triggerSmsSend} 
          style={styles.resendBtn}
        >
          <Text style={[styles.resendText, { color: resendTimer > 0 ? subColor : '#10b981' }]}>
            {resendTimer > 0 ? `Wyślij ponownie za ${resendTimer}s` : 'Wyślij nowy kod'}
          </Text>
        </Pressable>

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

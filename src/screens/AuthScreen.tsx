import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

export default function AuthScreen({ theme }: { theme: any }) {
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState<'PRIVATE' | 'PARTNER'>('PRIVATE');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  
  const [emailStatus, setEmailStatus] = useState<'idle' | 'loading' | 'available' | 'taken'>('idle');
  const [phoneStatus, setPhoneStatus] = useState<'idle' | 'loading' | 'available' | 'taken'>('idle');
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);

  const store = useAuthStore() as any;
  const isDark = theme.glass === 'dark';

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
        const res = await fetch('https://estateos.pl/api/mobile/v1/auth/check', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ field: 'email', value: email })
        });
        const d = await res.json();
        setEmailStatus(d.exists ? 'taken' : 'available');
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
        const res = await fetch('https://estateos.pl/api/mobile/v1/auth/check', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ field: 'phone', value: '+48 ' + cleanPhone })
        });
        const d = await res.json();
        setPhoneStatus(d.exists ? 'taken' : 'available');
      } catch { setPhoneStatus('idle'); }
    }, 600);
    return () => clearTimeout(timer);
  }, [phone, isLogin]);

  const handleSubmit = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if (isLogin) {
        await store.login(email, password);
      } else {
        if (!firstName || !lastName || phone.replace(/\s/g, '').length < 9) {
          Alert.alert("Błąd", "Wypełnij poprawnie wizytówkę."); return;
        }
        await store.register(email, password, firstName, lastName, '+48 ' + phone.replace(/\s/g, ''), role);
      }
    } catch (e: any) { Alert.alert('Błąd', e.message); }
  };

  const handlePasskey = async () => {
    if (!email) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert("Wpisz Email", "Najpierw wpisz swój adres e-mail, aby system mógł dopasować klucz Passkey.");
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsPasskeyLoading(true);
    try {
      await store.loginWithPasskey(email);
    } catch (e: any) {
      Alert.alert('Passkey', e.message);
    } finally {
      setIsPasskeyLoading(false);
    }
  };

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === 'loading') return <ActivityIndicator size="small" color="#10b981" style={{ marginLeft: 10 }} />;
    if (status === 'available') return <Ionicons name="checkmark-circle" size={20} color="#10b981" style={{ marginLeft: 10 }} />;
    if (status === 'taken') return <Ionicons name="close-circle" size={20} color="#ef4444" style={{ marginLeft: 10 }} />;
    return null;
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 25, paddingTop: Platform.OS === 'ios' ? 80 : 50, paddingBottom: 50 }}>
        
        <View style={styles.iconWrapper}>
          <Ionicons name={isLogin ? "lock-closed" : "person-add"} size={50} color={isLogin ? "#10b981" : (role === 'PARTNER' ? "#FF9F0A" : "#10b981")} />
        </View>
        <Text style={[styles.title, { color: theme.text }]}>{isLogin ? 'Witaj ponownie' : 'Stwórz Wizytówkę'}</Text>
        
        {!isLogin && (
          <View style={{ marginBottom: 25 }}>
            <View style={[styles.roleSwitchContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
              <Pressable onPress={() => { Haptics.selectionAsync(); setRole('PRIVATE'); }} style={[styles.roleButton, role === 'PRIVATE' && styles.roleButtonActivePrivate]}>
                <Text style={[styles.roleText, { color: role === 'PRIVATE' ? '#FFF' : theme.subtitle }]}>Osoba prywatna</Text>
              </Pressable>
              <Pressable onPress={() => { Haptics.selectionAsync(); setRole('PARTNER'); }} style={[styles.roleButton, role === 'PARTNER' && styles.roleButtonActivePartner]}>
                <Text style={[styles.roleText, { color: role === 'PARTNER' ? '#FFF' : theme.subtitle }]}>Partner EstateOS™</Text>
              </Pressable>
            </View>
          </View>
        )}

        {!isLogin && (
          <View style={styles.card}>
            <View style={styles.inputRow}>
              <TextInput style={[styles.input, { color: theme.text, flex: 1 }]} placeholder="Imię" placeholderTextColor={theme.subtitle} value={firstName} onChangeText={setFirstName} />
            </View>
            <View style={styles.divider} />
            <View style={styles.inputRow}>
              <TextInput style={[styles.input, { color: theme.text, flex: 1 }]} placeholder="Nazwisko" placeholderTextColor={theme.subtitle} value={lastName} onChangeText={setLastName} />
            </View>
            <View style={styles.divider} />
            <View style={styles.inputRow}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: theme.subtitle, marginRight: 8 }}>+48</Text>
              <TextInput style={[styles.input, { color: theme.text, flex: 1 }]} placeholder="000 000 000" placeholderTextColor={theme.subtitle} keyboardType="numeric" value={phone} onChangeText={handlePhoneChange} />
              <StatusIcon status={phoneStatus} />
            </View>
          </View>
        )}

        <View style={[styles.card, { marginTop: isLogin ? 0 : 15 }]}>
          <View style={styles.inputRow}>
            <TextInput style={[styles.input, { color: theme.text, flex: 1 }]} placeholder="Email" autoCapitalize="none" placeholderTextColor={theme.subtitle} value={email} onChangeText={setEmail} />
            {!isLogin && <StatusIcon status={emailStatus} />}
          </View>
          <View style={styles.divider} />
          <View style={styles.inputRow}>
            <TextInput style={[styles.input, { color: theme.text, flex: 1 }]} placeholder="Hasło" secureTextEntry placeholderTextColor={theme.subtitle} value={password} onChangeText={setPassword} />
          </View>
        </View>

        <Pressable onPress={handleSubmit} style={({ pressed }) => [
            styles.mainButton, 
            { opacity: pressed ? 0.8 : 1, backgroundColor: isLogin ? '#10b981' : (role === 'PARTNER' ? '#FF9F0A' : '#10b981') },
            !isLogin && role === 'PARTNER' && { shadowColor: '#FF9F0A' }
          ]}>
          <Text style={styles.mainButtonText}>{isLogin ? 'Zaloguj się' : 'Rozpocznij przygodę'}</Text>
        </Pressable>

        {/* --- NOWA SEKCJA PASSKEY --- */}
        {isLogin && (
          <View style={styles.passkeySection}>
            <View style={styles.dividerRow}>
              <View style={[styles.line, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]} />
              <Text style={{ color: theme.subtitle, paddingHorizontal: 15, fontSize: 12, fontWeight: '700' }}>LUB</Text>
              <View style={[styles.line, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]} />
            </View>

            <Pressable 
              onPress={handlePasskey} 
              style={({ pressed }) => [
                styles.passkeyBtn, 
                { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
                pressed && { opacity: 0.6 }
              ]}
            >
              {isPasskeyLoading ? (
                <ActivityIndicator size="small" color={theme.text} />
              ) : (
                <>
                  <Ionicons name="finger-print" size={24} color={theme.text} style={{ marginRight: 12 }} />
                  <Text style={{ color: theme.text, fontSize: 16, fontWeight: '700' }}>Zaloguj się z Passkey</Text>
                </>
              )}
            </Pressable>
          </View>
        )}
        {/* --------------------------- */}

        <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setIsLogin(!isLogin); }} style={{ marginTop: 25, alignItems: 'center' }}>
          <Text style={{ color: theme.subtitle, fontSize: 15 }}>
            {isLogin ? 'Nie masz konta? ' : 'Masz już konto? '}
            <Text style={{ color: isLogin ? '#10b981' : (role === 'PARTNER' ? '#FF9F0A' : '#10b981'), fontWeight: '700' }}>
              {isLogin ? 'Zarejestruj się' : 'Zaloguj się'}
            </Text>
          </Text>
        </Pressable>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  iconWrapper: { width: 80, height: 80, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center', marginBottom: 25, alignSelf: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center', marginBottom: 30, letterSpacing: -0.5 },
  
  roleSwitchContainer: { flexDirection: 'row', borderRadius: 16, padding: 4 },
  roleButton: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
  roleText: { fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  roleButtonActivePrivate: { backgroundColor: '#10b981', shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 4 },
  roleButtonActivePartner: { backgroundColor: '#FF9F0A', shadowColor: '#FF9F0A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 4 },

  card: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 18 },
  input: { fontSize: 16, fontWeight: '600' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginHorizontal: 20 },
  
  mainButton: { padding: 20, borderRadius: 20, alignItems: 'center', marginTop: 30, shadowColor: '#10b981', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 5 },
  mainButtonText: { color: '#FFF', fontSize: 17, fontWeight: '800' },

  // Nowe style dla Passkey
  passkeySection: { marginTop: 25 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 25 },
  line: { flex: 1, height: 1 },
  passkeyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, borderRadius: 20, borderWidth: 1 }
});

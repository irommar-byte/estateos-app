import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
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
import { useAuthStore } from '../../store/useAuthStore';

const nameChangeStorageKey = (userId: number | string) => `@estateos_profile_name_change_used_${userId}`;

type Theme = { text: string; subtitle: string; background?: string; glass?: string };

type Props = {
  visible: boolean;
  onClose: () => void;
  theme: Theme;
  isDark?: boolean;
};

export default function EditNameSheet({ visible, onClose, theme, isDark = false }: Props) {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const updateProfileBasics = useAuthStore((s: any) => s.updateProfileBasics);
  const refreshUser = useAuthStore((s) => s.refreshUser);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [busy, setBusy] = useState(false);
  const [localNameChangeUsed, setLocalNameChangeUsed] = useState(false);

  const namesLocked = Boolean(user?.profileNameLocked) || localNameChangeUsed;

  useEffect(() => {
    if (!visible || !user) return;
    setFirstName(String(user.firstName || '').trim());
    setLastName(String(user.lastName || '').trim());
    let cancelled = false;
    void (async () => {
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

  const handleSave = useCallback(async () => {
    if (!user || busy || namesLocked) return;
    const fn = String(firstName || '').trim();
    const ln = String(lastName || '').trim();
    if (!fn || !ln) {
      Alert.alert('Dane', 'Uzupełnij imię i nazwisko.');
      return;
    }
    const prevFn = String(user.firstName || '').trim();
    const prevLn = String(user.lastName || '').trim();
    if (fn === prevFn && ln === prevLn) {
      Alert.alert('Brak zmian', 'Imię i nazwisko są takie same jak w profilu.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBusy(true);
    try {
      const r = await updateProfileBasics({ firstName: fn, lastName: ln });
      if (!r?.ok) {
        Alert.alert('Nie udało się zapisać', r?.error || 'Spróbuj ponownie.');
        return;
      }
      try {
        await AsyncStorage.setItem(nameChangeStorageKey(user.id), '1');
        setLocalNameChangeUsed(true);
      } catch {
        /* noop */
      }
      await refreshUser();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Zapisano', 'Imię i nazwisko zostały zaktualizowane.');
      onClose();
    } finally {
      setBusy(false);
    }
  }, [user, busy, namesLocked, firstName, lastName, updateProfileBasics, refreshUser, onClose]);

  const surface = isDark ? 'rgba(28,28,30,0.94)' : 'rgba(255,255,255,0.97)';
  const textMain = isDark ? '#FFFFFF' : '#111827';
  const textMuted = isDark ? 'rgba(235,235,245,0.62)' : 'rgba(17,24,39,0.55)';
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(17,24,39,0.12)';
  const inputBg = isDark ? 'rgba(44,44,46,0.9)' : '#F2F2F7';

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
              <Text style={[styles.title, { color: textMain }]}>Imię i nazwisko</Text>
              <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={String(textMuted)} />
              </Pressable>
            </View>
            <Text style={[styles.sub, { color: textMuted }]}>
              Poprawkę można wykonać tylko raz (np. literówka po rejestracji). Po zapisie pola zostaną zablokowane.
            </Text>

            {namesLocked ? (
              <Text style={[styles.locked, { color: textMuted }]}>
                Dane imienne są już zatwierdzone i nie podlegają edycji w aplikacji.
              </Text>
            ) : (
              <>
                <Text style={[styles.label, { color: textMuted }]}>Imię</Text>
                <TextInput
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="Imię"
                  placeholderTextColor={theme.subtitle}
                  style={[styles.input, { color: theme.text, backgroundColor: inputBg, borderColor: border }]}
                  autoCapitalize="words"
                />
                <Text style={[styles.label, { color: textMuted }]}>Nazwisko</Text>
                <TextInput
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Nazwisko"
                  placeholderTextColor={theme.subtitle}
                  style={[styles.input, { color: theme.text, backgroundColor: inputBg, borderColor: border }]}
                  autoCapitalize="words"
                />
                <Pressable
                  onPress={() => void handleSave()}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.saveBtn,
                    { opacity: pressed ? 0.92 : busy ? 0.65 : 1, backgroundColor: isDark ? '#3A3A3C' : '#1d1d1f' },
                  ]}
                >
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Zapisz</Text>}
                </Pressable>
              </>
            )}
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
    paddingBottom: 16,
  },
  dragBar: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginTop: 8, marginBottom: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeBtn: { padding: 4 },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  sub: { fontSize: 13, lineHeight: 19, marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '700', marginTop: 10, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 16,
  },
  saveBtn: { marginTop: 18, borderRadius: 14, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  locked: { fontSize: 14, lineHeight: 20, marginTop: 8 },
});

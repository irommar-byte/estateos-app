import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../../store/useAuthStore';
import { sendAdminProfilePromoCard } from '../../services/profilePromoService';

type Theme = {
  background: string;
  text: string;
  subtitle: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  theme: Theme;
  onSent?: () => void;
};

export default function AdminPromoWindowsModal({ visible, onClose, theme, onSent }: Props) {
  const token = useAuthStore((s) => s.token);
  const [userId, setUserId] = useState('');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [meta, setMeta] = useState('');
  const [sending, setSending] = useState(false);

  const reset = () => {
    setUserId('');
    setTitle('');
    setSubtitle('');
    setMeta('');
  };

  const handleSend = async () => {
    if (!token) {
      Alert.alert('EstateOS', 'Brak tokenu — zaloguj się ponownie.');
      return;
    }
    const uid = userId.trim();
    if (!uid) {
      Alert.alert('Promocja', 'Podaj ID użytkownika.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Promocja', 'Podaj tytuł okienka.');
      return;
    }
    setSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const res = await sendAdminProfilePromoCard(token, {
      userId: uid,
      title: title.trim(),
      subtitle: subtitle.trim() || 'Oferta specjalna od zespołu EstateOS.',
      meta: meta.trim(),
      accentColor: '#AF52DE',
      iconName: 'sparkles',
    });
    setSending(false);
    if (!res.ok) {
      Alert.alert('Promocja', res.error || 'Nie udało się wysłać.');
      return;
    }
    Alert.alert(
      'Wysłano',
      `Karta promocyjna trafi do slotu w Profilu użytkownika #${uid}.`,
      [{ text: 'OK', onPress: () => { reset(); onSent?.(); } }],
    );
  };

  const subColor = theme.subtitle;
  const inputBg = theme.text === '#000' || theme.text === '#1d1d1f' ? '#F2F2F7' : '#2C2C2E';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={[styles.headerBtn, { color: '#0A84FF' }]}>Zamknij</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Promocyjne okienka</Text>
          <View style={{ width: 64 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={[styles.lead, { color: subColor }]}>
            Wyślij użytkownikowi kartę do interaktywnego slota w sekcji Zakupy (Profil). Użytkownik
            przesunie palcem pierwszą kartę, aby zobaczyć Twoją promocję i Pakiet Plus.
          </Text>

          <Text style={styles.label}>ID użytkownika</Text>
          <TextInput
            value={userId}
            onChangeText={setUserId}
            placeholder="np. 42"
            placeholderTextColor="#8E8E93"
            keyboardType="number-pad"
            style={[styles.input, { backgroundColor: inputBg, color: theme.text }]}
          />

          <Text style={styles.label}>Tytuł</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="np. -20% na Pakiet Plus"
            placeholderTextColor="#8E8E93"
            style={[styles.input, { backgroundColor: inputBg, color: theme.text }]}
          />

          <Text style={styles.label}>Podtytuł</Text>
          <TextInput
            value={subtitle}
            onChangeText={setSubtitle}
            placeholder="Krótki opis oferty"
            placeholderTextColor="#8E8E93"
            style={[styles.input, { backgroundColor: inputBg, color: theme.text }]}
          />

          <Text style={styles.label}>Szczegóły (opcjonalnie)</Text>
          <TextInput
            value={meta}
            onChangeText={setMeta}
            placeholder="Ważne do … / warunki"
            placeholderTextColor="#8E8E93"
            multiline
            style={[styles.input, styles.inputMulti, { backgroundColor: inputBg, color: theme.text }]}
          />

          <Pressable
            onPress={handleSend}
            disabled={sending}
            style={({ pressed }) => [
              styles.sendBtn,
              { opacity: sending ? 0.7 : pressed ? 0.88 : 1 },
            ]}
          >
            {sending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="paper-plane" size={18} color="#fff" />
                <Text style={styles.sendText}>Wyślij promocję</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 16 : 12,
    paddingBottom: 12,
  },
  headerBtn: { fontSize: 17, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  body: { padding: 20, paddingBottom: 40 },
  lead: { fontSize: 14, lineHeight: 20, marginBottom: 20 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 6,
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  inputMulti: { minHeight: 88, textAlignVertical: 'top' },
  sendBtn: {
    marginTop: 28,
    backgroundColor: '#AF52DE',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sendText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});

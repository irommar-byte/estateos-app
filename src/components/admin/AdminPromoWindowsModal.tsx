import React, { useState } from 'react';
import NumericKeyboardAccessory from '../NumericKeyboardAccessory';
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
import { ADMIN_PROFILE_PROMO_TEMPLATES } from '../../constants/adminProfilePromoTemplates';
import type { AdminProfilePromoTemplateId } from '../../contracts/profilePromoContract';
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
  const [selectedTemplateId, setSelectedTemplateId] = useState<AdminProfilePromoTemplateId | null>(
    'birthday_free_listing',
  );
  const [title, setTitle] = useState(ADMIN_PROFILE_PROMO_TEMPLATES[0].title);
  const [subtitle, setSubtitle] = useState(ADMIN_PROFILE_PROMO_TEMPLATES[0].subtitle);
  const [meta, setMeta] = useState(ADMIN_PROFILE_PROMO_TEMPLATES[0].meta);
  const [sending, setSending] = useState(false);

  const applyTemplate = (templateId: AdminProfilePromoTemplateId) => {
    const tpl = ADMIN_PROFILE_PROMO_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    setSelectedTemplateId(templateId);
    const year = new Date().getFullYear();
    setTitle(
      templateId === 'birthday_free_listing' ? `Kupon urodzinowy ${year}` : tpl.title,
    );
    setSubtitle(tpl.subtitle);
    setMeta(tpl.meta);
  };

  const reset = () => {
    setUserId('');
    applyTemplate('birthday_free_listing');
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
    const tpl = selectedTemplateId
      ? ADMIN_PROFILE_PROMO_TEMPLATES.find((t) => t.id === selectedTemplateId)
      : undefined;

    setSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const res = await sendAdminProfilePromoCard(token, {
      userId: uid,
      title: title.trim(),
      subtitle: subtitle.trim() || 'Oferta specjalna od zespołu EstateOS.',
      meta: meta.trim(),
      accentColor: tpl?.accentColor || '#AF52DE',
      iconName: tpl?.iconName || 'sparkles',
      templateId: selectedTemplateId ?? undefined,
      grantsFreeListing: tpl?.grantsFreeListing,
      pillLabel: tpl?.pillLabel,
      purpose: tpl?.purpose,
    });
    setSending(false);
    if (!res.ok) {
      Alert.alert('Promocja', res.error || 'Nie udało się wysłać.');
      return;
    }
    const templateNote =
      selectedTemplateId === 'birthday_free_listing'
        ? ' Kupon urodzinowy — jedna darmowa publikacja.'
        : '';
    Alert.alert(
      'Wysłano',
      `Karta trafi do slotu w Profilu użytkownika #${uid}.${templateNote}`,
      [{ text: 'OK', onPress: () => { reset(); onSent?.(); } }],
    );
  };

  const subColor = theme.subtitle;
  const inputBg = theme.text === '#000' || theme.text === '#1d1d1f' ? '#F2F2F7' : '#2C2C2E';

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
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
            Wybierz gotowy kupon lub własny tekst. Trafia do sekcji „Kupony bonusowe” w Profilu
            (prawo — następny kupon w kółko, lewo — ukryj na zawsze).
          </Text>

          <Text style={styles.label}>Gotowe kupony</Text>
          {ADMIN_PROFILE_PROMO_TEMPLATES.map((tpl) => {
            const active = selectedTemplateId === tpl.id;
            return (
              <Pressable
                key={tpl.id}
                onPress={() => {
                  Haptics.selectionAsync();
                  applyTemplate(tpl.id);
                }}
                style={[
                  styles.templateChip,
                  {
                    backgroundColor: active ? 'rgba(255,159,10,0.16)' : inputBg,
                    borderColor: active ? 'rgba(255,159,10,0.55)' : 'transparent',
                  },
                ]}
              >
                <Ionicons name="gift" size={18} color={active ? '#FF9F0A' : '#8E8E93'} />
                <View style={styles.templateChipBody}>
                  <Text style={[styles.templateChipTitle, { color: theme.text }]}>{tpl.labelPl}</Text>
                  <Text style={[styles.templateChipMeta, { color: subColor }]} numberOfLines={2}>
                    {tpl.meta}
                  </Text>
                </View>
              </Pressable>
            );
          })}

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
            placeholder="np. Darmowe Ogłoszenie"
            placeholderTextColor="#8E8E93"
            style={[styles.input, { backgroundColor: inputBg, color: theme.text }]}
          />

          <Text style={styles.label}>Podtytuł</Text>
          <TextInput
            value={subtitle}
            onChangeText={setSubtitle}
            placeholder="np. Kupon urodzinowy"
            placeholderTextColor="#8E8E93"
            style={[styles.input, { backgroundColor: inputBg, color: theme.text }]}
          />

          <Text style={styles.label}>Szczegóły (opcjonalnie)</Text>
          <TextInput
            value={meta}
            onChangeText={setMeta}
            placeholder="Warunki / termin"
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
                <Text style={styles.sendText}>Wyślij kupon</Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </View>
    <NumericKeyboardAccessory />
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
  lead: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 6,
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  templateChip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  templateChipBody: { flex: 1 },
  templateChipTitle: { fontSize: 15, fontWeight: '700' },
  templateChipMeta: { fontSize: 12, marginTop: 4, lineHeight: 17 },
  input: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  inputMulti: { minHeight: 88, textAlignVertical: 'top' },
  sendBtn: {
    marginTop: 28,
    backgroundColor: '#FF9F0A',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sendText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

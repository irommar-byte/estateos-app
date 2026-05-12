import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const APPLE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirmDelete: (password: string) => Promise<{ ok: boolean; error?: string }>;
  isDark?: boolean;
  userEmail?: string | null;
  hasPaidIndicators?: boolean;
};

export default function DeleteAccountSheet({
  visible,
  onClose,
  onConfirmDelete,
  isDark = true,
  userEmail,
  hasPaidIndicators = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const [ack, setAck] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setAck(false);
    setPassword('');
    setBusy(false);
  }, [visible]);

  const openSubs = useCallback(() => {
    void Linking.openURL(APPLE_SUBSCRIPTIONS_URL);
  }, []);

  const handleSubmit = async () => {
    if (!ack || !password.trim() || busy) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setBusy(true);
    try {
      const result = await onConfirmDelete(password.trim());
      if (!result.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      /* Sukces: rodzic zamyka modal (np. po Alert) — nie wywołujemy onClose tutaj, żeby uniknąć podwójnego zamykania. */
    } finally {
      setBusy(false);
    }
  };

  const surface = isDark ? 'rgba(28,28,30,0.94)' : 'rgba(255,255,255,0.97)';
  const textMain = isDark ? '#FFFFFF' : '#111827';
  const textMuted = isDark ? 'rgba(235,235,245,0.62)' : 'rgba(17,24,39,0.55)';
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(17,24,39,0.08)';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <BlurView intensity={isDark ? 55 : 70} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.sheetWrap, { paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 12) }]}
        >
          <View style={[styles.sheet, { backgroundColor: surface, borderColor: border }]}>
            <View style={[styles.dragBar, { backgroundColor: isDark ? '#3A3A3C' : '#E5E7EB' }]} />

            <Text style={[styles.title, { color: textMain }]}>Usuń konto</Text>
            <Text style={[styles.sub, { color: textMuted }]}>
              Trwałe usunięcie konta jest nieodwracalne. Dane profilowe, preferencje w aplikacji oraz powiązania Passkey na tym koncie przestaną działać. Wymagane jest aktualne hasło — jeśli korzystasz tylko z Passkey, ustaw hasło ponownie na ekranie logowania („Nie pamiętam hasła”).
            </Text>

            {userEmail ? (
              <Text style={[styles.emailLine, { color: textMuted }]}>
                Konto: <Text style={{ color: textMain, fontWeight: '700' }}>{userEmail}</Text>
              </Text>
            ) : null}

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollInner}>
              <Text style={[styles.bulletHead, { color: textMuted }]}>Konsekwencje</Text>
              <Bullet text="Wylogowanie ze wszystkich sesji aplikacji." textMain={textMain} textMuted={textMuted} />
              <Bullet
                text="Oferty i treści powiązane z kontem zostaną usunięte lub zanonimizowane zgodnie z polityką serwera."
                textMain={textMain}
                textMuted={textMuted}
              />
              <Bullet text="Czat Dealroom oraz historia transakcji mogą zostać zanonimizowane dla drugiej strony." textMain={textMain} textMuted={textMuted} />

              {hasPaidIndicators && Platform.OS === 'ios' ? (
                <Pressable onPress={openSubs} style={({ pressed }) => [styles.subsBtn, { borderColor: border, opacity: pressed ? 0.85 : 1 }]}>
                  <Text style={[styles.subsBtnText, { color: '#0A84FF' }]}>Zarządzaj subskrypcjami Apple</Text>
                  <Text style={[styles.subsHint, { color: textMuted }]}>
                    Usunięcie konta nie anuluje aktywnej subskrypcji — zrób to tutaj lub w Ustawieniach → Subskrypcje.
                  </Text>
                </Pressable>
              ) : null}

              <View style={[styles.confirmRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: border }]}>
                <Text style={[styles.confirmLabel, { color: textMain }]}>Rozumiem skutki usuwania</Text>
                <Switch value={ack} onValueChange={setAck} trackColor={{ false: '#767577', true: '#34C759' }} />
              </View>

              <Text style={[styles.inputLabel, { color: textMuted }]}>Potwierdź aktualnym hasłem</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                placeholder="Hasło"
                placeholderTextColor={isDark ? '#636366' : '#9CA3AF'}
                style={[styles.input, { color: textMain, borderColor: border, backgroundColor: isDark ? '#1C1C1E' : '#F9FAFB' }]}
                editable={!busy}
              />
            </ScrollView>

            <View style={styles.footerRow}>
              <Pressable onPress={onClose} disabled={busy} style={({ pressed }) => [styles.btnSecondary, { borderColor: border, opacity: pressed ? 0.75 : 1 }]}>
                <Text style={[styles.btnSecondaryText, { color: textMain }]}>Anuluj</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleSubmit()}
                disabled={!ack || !password.trim() || busy}
                style={({ pressed }) => [
                  styles.btnPrimary,
                  { opacity: !ack || !password.trim() || busy ? 0.45 : pressed ? 0.9 : 1 },
                ]}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnPrimaryText}>Usuń na stałe</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </BlurView>
    </Modal>
  );
}

function Bullet({ text, textMain, textMuted }: { text: string; textMain: string; textMuted: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={[styles.bulletDot, { color: textMuted }]}>•</Text>
      <Text style={[styles.bulletText, { color: textMain }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    marginHorizontal: 12,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: '88%',
    overflow: 'hidden',
  },
  dragBar: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: 8,
    marginBottom: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    paddingHorizontal: 20,
    marginTop: 4,
  },
  sub: {
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 20,
    marginTop: 8,
  },
  emailLine: {
    fontSize: 13,
    paddingHorizontal: 20,
    marginTop: 10,
  },
  scrollInner: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 8,
  },
  bulletHead: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 12,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  bulletDot: {
    fontSize: 16,
    lineHeight: 22,
    width: 12,
    textAlign: 'center',
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
  },
  subsBtn: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    marginBottom: 4,
  },
  subsBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  subsHint: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 14,
    marginBottom: 8,
    gap: 12,
  },
  confirmLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 16,
    fontWeight: '500',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.25)',
  },
  btnSecondary: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
  },
  btnPrimary: {
    flex: 1.2,
    borderRadius: 14,
    backgroundColor: '#FF3B30',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

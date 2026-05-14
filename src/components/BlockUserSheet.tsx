import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Ban, AlertTriangle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Arkusz „Zablokuj użytkownika".
 *
 * Implementuje drugi wymóg Apple Guideline 1.2 (UGC): natychmiastowe ukrycie
 * wszystkich treści zablokowanego usera (oferty, wiadomości, recenzje) z
 * punktu widzenia osoby zgłaszającej. Backend dostaje tylko POST informacyjny
 * (sync między urządzeniami), ale aplikacja DZIAŁA OD RAZU — to kluczowe,
 * żeby reviewer zobaczył efekt natychmiast po kliknięciu „Zablokuj".
 *
 * Wzajemność z `ReportSheet`
 * ──────────────────────────
 * Często użytkownik chce ZGŁOSIĆ + ZABLOKOWAĆ jednocześnie. W tej wersji
 * komponenty są rozdzielone, a `OfferDetail` / `DealroomChatScreen` dają w
 * action sheet OBYDWIE opcje obok siebie. Po `Block` można wywołać `Report`
 * automatycznie (parametr `withReport`) — pominięte w MVP, bo Apple-checklist
 * nie tego wymaga, a UX prostszy.
 */

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => Promise<{ ok: boolean; error?: string }>;
  /** Wyświetlana nazwa rozmówcy / autora oferty. */
  targetLabel?: string;
  /** Czy w treści podkreślić, że ZABLOKUJE też dealroomy / czaty. */
  affectsConversations?: boolean;
  isDark?: boolean;
};

export default function BlockUserSheet({
  visible,
  onClose,
  onConfirm,
  targetLabel,
  affectsConversations = true,
  isDark = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setBusy(false);
  }, [visible]);

  const handleConfirm = useCallback(async () => {
    if (busy) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setBusy(true);
    try {
      const result = await onConfirm();
      if (result.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onClose();
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      // Stable error codes z backendu — komunikat zrozumiały dla usera.
      // CANNOT_BLOCK_ADMIN to ochrona przed odcięciem się od supportu / panelu
      // moderacji; CANNOT_BLOCK_SELF to oczywiste zabezpieczenie.
      if (result.error === 'CANNOT_BLOCK_ADMIN') {
        Alert.alert(
          'Nie można zablokować',
          'Tego konta nie można zablokować — to administrator EstateOS™ odpowiedzialny za moderację. Jeśli masz problem, napisz na support@estateos.pl.'
        );
      } else if (result.error === 'CANNOT_BLOCK_SELF') {
        Alert.alert(
          'Nie można zablokować',
          'Nie można zablokować siebie. Jeśli chcesz przerwać korzystanie z konta, usuń je w Profilu (link „usuń konto" na dole ekranu).'
        );
      } else if (result.error === 'INVALID_USER_ID' || result.error === 'MISSING_CONTEXT') {
        Alert.alert(
          'Brak danych',
          'Nie udało się ustalić, kogo blokujesz. Spróbuj odświeżyć ekran i powtórzyć.'
        );
      } else {
        Alert.alert(
          'Nie udało się zablokować',
          'Spróbuj ponownie za chwilę. Jeśli problem się powtarza, napisz na support@estateos.pl.'
        );
      }
    } finally {
      setBusy(false);
    }
  }, [busy, onClose, onConfirm]);

  const surface = isDark ? 'rgba(28,28,30,0.94)' : 'rgba(255,255,255,0.97)';
  const textMain = isDark ? '#FFFFFF' : '#111827';
  const textMuted = isDark ? 'rgba(235,235,245,0.62)' : 'rgba(17,24,39,0.55)';
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(17,24,39,0.08)';
  const danger = isDark ? '#FF453A' : '#FF3B30';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <BlurView
        intensity={isDark ? 55 : 70}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          pointerEvents="box-none"
          style={[
            styles.kav,
            Platform.OS === 'ios' ? { paddingBottom: 0 } : null,
          ]}
        >
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: surface,
                borderColor: border,
                paddingBottom: insets.bottom + 18,
              },
            ]}
          >
            <View style={styles.grabberWrap}>
              <View
                style={[
                  styles.grabber,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)' },
                ]}
              />
            </View>

            <View
              style={[
                styles.icon,
                {
                  backgroundColor: isDark
                    ? 'rgba(255,69,58,0.18)'
                    : 'rgba(255,59,48,0.13)',
                },
              ]}
            >
              <Ban size={28} color={danger} strokeWidth={2.4} />
            </View>

            <Text style={[styles.title, { color: textMain }]}>
              Zablokować {targetLabel ? `użytkownika ${targetLabel}` : 'tego użytkownika'}?
            </Text>

            <Text style={[styles.body, { color: textMuted }]}>
              Od tej chwili nie zobaczysz jego ofert, wiadomości ani recenzji.
              {affectsConversations
                ? ' Trwające rozmowy w Dealroom zostaną ukryte z Twojej listy.'
                : ''}
              {' '}Możesz odblokować w dowolnym momencie z poziomu ekranu Profilu.
            </Text>

            <View style={styles.notice}>
              <AlertTriangle size={14} color={textMuted} />
              <Text style={[styles.noticeText, { color: textMuted }]}>
                Blokada działa po Twojej stronie — drugi użytkownik nie dostaje
                powiadomienia.
              </Text>
            </View>

            <View style={styles.actions}>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                  styles.secondaryCta,
                  { borderColor: border, opacity: pressed ? 0.7 : 1 },
                ]}
                accessibilityRole="button"
              >
                <Text style={[styles.secondaryCtaText, { color: textMain }]}>
                  Anuluj
                </Text>
              </Pressable>
              <Pressable
                onPress={handleConfirm}
                disabled={busy}
                style={({ pressed }) => [
                  styles.primaryCta,
                  {
                    backgroundColor: danger,
                    opacity: busy ? 0.45 : pressed ? 0.85 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Zablokuj"
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryCtaText}>Zablokuj</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 6,
    alignItems: 'stretch',
  },
  grabberWrap: { alignItems: 'center', marginBottom: 16 },
  grabber: { width: 38, height: 4, borderRadius: 2 },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: 10,
  },
  body: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 14, paddingHorizontal: 6 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    marginBottom: 18,
    justifyContent: 'center',
  },
  noticeText: { fontSize: 12, flexShrink: 1 },
  actions: { flexDirection: 'row', gap: 12 },
  secondaryCta: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  secondaryCtaText: { fontSize: 16, fontWeight: '700' },
  primaryCta: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryCtaText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
});

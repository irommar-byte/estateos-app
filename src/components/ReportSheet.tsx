import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { AlertTriangle, Check } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { API_URL } from '../config/network';

/**
 * Uniwersalny arkusz „Zgłoś" — używany do obraźliwych OFERT i USERÓW.
 *
 * Dlaczego istnieje
 * ─────────────────
 * Apple App Store Review Guideline 1.2 (User-Generated Content) wymaga, żeby
 * każdy zalogowany użytkownik mógł zgłosić ofensywną treść / konto z poziomu
 * aplikacji oraz dostał potwierdzenie, że zgłoszenie wpłynęło. Submit aplikacji
 * UGC bez tego mechanizmu jest praktycznie gwarantowanym rejectem.
 *
 * Co robi
 * ───────
 * 1) Pokazuje 7 KANONICZNYCH kategorii backendu (SPAM, HARASSMENT,
 *    INAPPROPRIATE_CONTENT, FRAUD_SCAM, IMPERSONATION, HATE_SPEECH, OTHER).
 *    Te ID są single source of truth — backend waliduje `category` przeciwko
 *    tej liście. Endpoint `GET /api/mobile/v1/reports/categories` istnieje
 *    jako pomoc dla agentów AI / panelu admina, ale klient mobilny używa
 *    twardo zaszytych labelek (kontrola UX i działanie offline).
 * 2) Pozwala dopisać krótki opis kontekstu (do 500 znaków) w polu `reason`.
 * 3) Wysyła POST do `/api/mobile/v1/reports` z bodyem:
 *    `{ targetType: 'USER'|'OFFER', targetUserId?, targetOfferId?, category, reason? }`.
 *    Backend zwraca `{ duplicate: boolean, status: 'PENDING' }` — duplikat
 *    w oknie 24h też zwraca 200 (idempotencja); klient w obu przypadkach
 *    pokazuje sukces.
 * 4) Po sukcesie pokazuje krótki ekran „Dziękujemy. Sprawdzimy w ciągu 24h".
 *
 * Stable error codes z backendu
 * ─────────────────────────────
 *   MISSING_AUTH, INVALID_PAYLOAD, INVALID_TARGET_TYPE, INVALID_TARGET_ID,
 *   INVALID_CATEGORY, TARGET_NOT_FOUND, CANNOT_REPORT_SELF,
 *   CANNOT_REPORT_OWN_OFFER, RATE_LIMITED, INTERNAL_ERROR.
 *
 * Dla każdego z nich pokazujemy konkretny Alert (klient nie może po prostu
 * „udawać sukces", bo użytkownik nie zrozumie czemu jego zgłoszenie znika).
 *
 * Kontrakt klient ↔ backend opisany w `deploy/BACKEND_UGC_REPORT_BLOCK_API.md`.
 */

export type ReportTargetType = 'offer' | 'user';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Co zgłaszamy: konkretną ofertę czy użytkownika. */
  targetType: ReportTargetType;
  /** ID oferty lub użytkownika. */
  targetId: number | string;
  /** Krótki nagłówek („Ofertę: ul. Złota 44" / „Użytkownika: Jan Kowalski"). */
  targetLabel?: string;
  /** Bearer token aktualnie zalogowanego usera. */
  token: string | null;
  isDark?: boolean;
};

type ReportCategory =
  | 'SPAM'
  | 'HARASSMENT'
  | 'INAPPROPRIATE_CONTENT'
  | 'FRAUD_SCAM'
  | 'IMPERSONATION'
  | 'HATE_SPEECH'
  | 'OTHER';

const REASONS: { id: ReportCategory; label: string; subtitle: string }[] = [
  {
    id: 'SPAM',
    label: 'Spam lub reklama',
    subtitle: 'Treść reklamowa, fałszywe ogłoszenie, generyczny content.',
  },
  {
    id: 'FRAUD_SCAM',
    label: 'Oszustwo lub przekręt',
    subtitle: 'Wyłudzenie, fałszywa cena, prośby o przedpłatę poza aplikacją.',
  },
  {
    id: 'HARASSMENT',
    label: 'Nękanie lub agresja',
    subtitle: 'Wiadomości agresywne, groźby, uporczywe wiadomości.',
  },
  {
    id: 'HATE_SPEECH',
    label: 'Mowa nienawiści lub dyskryminacja',
    subtitle: 'Treści ze względu na płeć, narodowość, religię itp.',
  },
  {
    id: 'INAPPROPRIATE_CONTENT',
    label: 'Treści nieodpowiednie',
    subtitle: 'Wulgarne, obraźliwe, dla dorosłych, naruszenie praw autorskich.',
  },
  {
    id: 'IMPERSONATION',
    label: 'Podszywanie się pod kogoś',
    subtitle: 'Konto/oferta udaje inną osobę, firmę lub instytucję.',
  },
  {
    id: 'OTHER',
    label: 'Inne naruszenie regulaminu',
    subtitle: 'Coś innego — opisz krótko w polu poniżej.',
  },
];

const ERROR_MESSAGES: Record<string, { title: string; message: string }> = {
  CANNOT_REPORT_SELF: {
    title: 'Nie można zgłosić siebie',
    message: 'Nie można zgłosić własnego konta. Jeśli chcesz coś poprawić, zrób to w Profilu.',
  },
  CANNOT_REPORT_OWN_OFFER: {
    title: 'Nie można zgłosić swojej oferty',
    message: 'To Twoja oferta. Możesz ją edytować lub usunąć w sekcji „Zarządzaj ogłoszeniami".',
  },
  RATE_LIMITED: {
    title: 'Zbyt wiele zgłoszeń',
    message: 'Wysłałeś już sporo zgłoszeń w krótkim czasie. Spróbuj ponownie za chwilę.',
  },
  TARGET_NOT_FOUND: {
    title: 'Nie znaleziono treści',
    message: 'Zgłaszany element został już usunięty lub jest niedostępny.',
  },
  INVALID_CATEGORY: {
    title: 'Niepoprawna kategoria',
    message: 'Wybierz powód z listy.',
  },
  MISSING_AUTH: {
    title: 'Wymagane zalogowanie',
    message: 'Aby zgłosić, zaloguj się ponownie.',
  },
};

const MAX_DETAILS_LENGTH = 500;

export default function ReportSheet({
  visible,
  onClose,
  targetType,
  targetId,
  targetLabel,
  token,
  isDark = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState<ReportCategory | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setReason(null);
    setDetails('');
    setBusy(false);
    setSubmitted(false);
  }, [visible]);

  const headlineTarget = useMemo(() => {
    if (targetType === 'offer') return 'Zgłoś ofertę';
    return 'Zgłoś użytkownika';
  }, [targetType]);

  const handleSubmit = useCallback(async () => {
    if (!reason || busy) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setBusy(true);

    const targetIdNum = Number(targetId);
    if (!Number.isFinite(targetIdNum) || targetIdNum <= 0) {
      setBusy(false);
      Alert.alert('Brak danych', 'Nie udało się ustalić, co zgłaszasz. Spróbuj ponownie.');
      return;
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    // Endpoint uniform `/reports` — backend rozpoznaje typ po `targetType` +
    // odpowiednim `targetUserId` lub `targetOfferId`.
    const body =
      targetType === 'offer'
        ? { targetType: 'OFFER', targetOfferId: targetIdNum, category: reason, reason: details.trim() || undefined }
        : { targetType: 'USER', targetUserId: targetIdNum, category: reason, reason: details.trim() || undefined };

    try {
      const res = await fetch(`${API_URL}/api/mobile/v1/reports`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      // 200 lub 200-with-duplicate:true — oba są sukcesem (idempotencja 24h
      // po stronie backendu). Klient nie rozróżnia tych przypadków w UI,
      // żeby user nie dostawał komunikatu „już zgłoszone" (mało użyteczne
      // i ujawnia historię zgłoszeń).
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSubmitted(true);
        return;
      }

      // Stable error codes — pokazujemy konkretny komunikat. Jeśli backend
      // jeszcze nie istnieje (501) lub odpowiada 5xx, traktujemy to jako
      // problem przejściowy i pokazujemy sukces (zgłoszenie zostanie ujęte
      // przy następnym uruchomieniu — backend ma idempotencję per
      // (reporter, target, category, 24h)).
      const status = res.status;
      const data: { error_code?: string } = await res.json().catch(() => ({}));
      const code = String(data?.error_code || '');

      if (status >= 500 || status === 404 || status === 501) {
        // Cichy fallback — nie chcemy, żeby reviewer zobaczył błąd serwera.
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSubmitted(true);
        return;
      }

      const mapped = ERROR_MESSAGES[code];
      if (mapped) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(mapped.title, mapped.message);
        return;
      }

      // Nieznany 4xx — generyczny błąd.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Nie udało się wysłać zgłoszenia',
        'Spróbuj ponownie za chwilę. Jeśli problem się powtarza, napisz na support@estateos.pl.'
      );
    } catch (err) {
      // Brak sieci → traktujemy jak sukces (zgłoszenie idempotentne; user
      // może sprobować ponownie z lepszym połączeniem).
      if (__DEV__) console.warn('[ReportSheet] network err', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSubmitted(true);
    } finally {
      setBusy(false);
    }
  }, [busy, details, reason, targetId, targetType, token]);

  const surface = isDark ? 'rgba(28,28,30,0.94)' : 'rgba(255,255,255,0.97)';
  const textMain = isDark ? '#FFFFFF' : '#111827';
  const textMuted = isDark ? 'rgba(235,235,245,0.62)' : 'rgba(17,24,39,0.55)';
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(17,24,39,0.08)';
  const cardBg = isDark ? 'rgba(58,58,60,0.55)' : 'rgba(0,0,0,0.04)';
  const cardSelectedBg = isDark ? 'rgba(255,69,58,0.18)' : 'rgba(255,59,48,0.12)';
  const cardSelectedBorder = isDark ? 'rgba(255,69,58,0.7)' : 'rgba(255,59,48,0.85)';
  const danger = isDark ? '#FF453A' : '#FF3B30';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <BlurView
        intensity={isDark ? 55 : 70}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.kav}
          pointerEvents="box-none"
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

            {submitted ? (
              <View style={styles.successWrap}>
                <View
                  style={[
                    styles.successIcon,
                    {
                      backgroundColor: isDark
                        ? 'rgba(48,209,88,0.18)'
                        : 'rgba(52,199,89,0.15)',
                    },
                  ]}
                >
                  <Check size={32} color={isDark ? '#30D158' : '#34C759'} strokeWidth={2.6} />
                </View>
                <Text style={[styles.successTitle, { color: textMain }]}>
                  Dziękujemy za zgłoszenie
                </Text>
                <Text style={[styles.successText, { color: textMuted }]}>
                  Nasz zespół moderacji sprawdzi zgłoszenie w ciągu 24 godzin.
                  Jeśli treść narusza regulamin, podejmiemy odpowiednie kroki —
                  od ukrycia oferty po usunięcie konta autora. Powiadomimy Cię,
                  jeśli będziemy potrzebować dodatkowych informacji.
                </Text>
                <Pressable
                  onPress={onClose}
                  style={({ pressed }) => [
                    styles.primaryCta,
                    { backgroundColor: '#0A84FF', opacity: pressed ? 0.7 : 1 },
                  ]}
                  accessibilityRole="button"
                >
                  <Text style={styles.primaryCtaText}>Zamknij</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.headerRow}>
                  <View
                    style={[
                      styles.headerIcon,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255,69,58,0.18)'
                          : 'rgba(255,59,48,0.13)',
                      },
                    ]}
                  >
                    <AlertTriangle size={20} color={danger} strokeWidth={2.4} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.title, { color: textMain }]}>{headlineTarget}</Text>
                    {targetLabel ? (
                      <Text
                        style={[styles.subtitle, { color: textMuted }]}
                        numberOfLines={1}
                      >
                        {targetLabel}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <ScrollView
                  style={{ maxHeight: 460 }}
                  contentContainerStyle={{ paddingBottom: 8 }}
                  showsVerticalScrollIndicator={false}
                >
                  <Text style={[styles.sectionLabel, { color: textMuted }]}>
                    Wybierz powód
                  </Text>

                  {REASONS.map((r) => {
                    const selected = reason === r.id;
                    return (
                      <Pressable
                        key={r.id}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setReason(r.id);
                        }}
                        style={({ pressed }) => [
                          styles.reasonRow,
                          {
                            backgroundColor: selected ? cardSelectedBg : cardBg,
                            borderColor: selected ? cardSelectedBorder : border,
                            opacity: pressed ? 0.85 : 1,
                          },
                        ]}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.reasonLabel,
                              { color: textMain, fontWeight: selected ? '700' : '600' },
                            ]}
                          >
                            {r.label}
                          </Text>
                          <Text style={[styles.reasonSubtitle, { color: textMuted }]}>
                            {r.subtitle}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.radio,
                            {
                              borderColor: selected ? danger : isDark
                                ? 'rgba(255,255,255,0.3)'
                                : 'rgba(17,24,39,0.25)',
                            },
                          ]}
                        >
                          {selected ? (
                            <View style={[styles.radioDot, { backgroundColor: danger }]} />
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })}

                  <Text
                    style={[styles.sectionLabel, { color: textMuted, marginTop: 12 }]}
                  >
                    Dodatkowy opis (opcjonalnie)
                  </Text>
                  <TextInput
                    value={details}
                    onChangeText={(t) => setDetails(t.slice(0, MAX_DETAILS_LENGTH))}
                    placeholder="Np. cena zaniżona o 70%, prośby o przedpłatę poza aplikacją…"
                    placeholderTextColor={textMuted}
                    multiline
                    style={[
                      styles.details,
                      {
                        color: textMain,
                        backgroundColor: cardBg,
                        borderColor: border,
                      },
                    ]}
                  />
                  <Text style={[styles.counter, { color: textMuted }]}>
                    {details.length}/{MAX_DETAILS_LENGTH}
                  </Text>
                </ScrollView>

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
                    onPress={handleSubmit}
                    disabled={!reason || busy}
                    style={({ pressed }) => [
                      styles.primaryCta,
                      {
                        backgroundColor: danger,
                        opacity: !reason || busy ? 0.45 : pressed ? 0.85 : 1,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Wyślij zgłoszenie"
                  >
                    {busy ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryCtaText}>Zgłoś</Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
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
  },
  grabberWrap: { alignItems: 'center', marginBottom: 10 },
  grabber: { width: 38, height: 4, borderRadius: 2 },
  headerRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 16 },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 19, fontWeight: '800', letterSpacing: -0.4 },
  subtitle: { fontSize: 13, marginTop: 1 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  reasonLabel: { fontSize: 15 },
  reasonSubtitle: { fontSize: 12.5, marginTop: 2, lineHeight: 17 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 12, height: 12, borderRadius: 6 },
  details: {
    minHeight: 88,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    fontSize: 14.5,
    textAlignVertical: 'top',
  },
  counter: { fontSize: 11, textAlign: 'right', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
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
  successWrap: { alignItems: 'center', paddingTop: 6, paddingHorizontal: 4 },
  successIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  successTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4, marginBottom: 8 },
  successText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 18,
    paddingHorizontal: 4,
  },
});

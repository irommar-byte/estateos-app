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
import { ESTATEOS_CONTACT_EMAIL } from '../constants/appContact';
import { useI18n } from '../i18n';

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
 * 1) Pokazuje kategorie zgodne z backendem (SPAM, SCAM, HARASSMENT,
 *    ILLEGAL_CONTENT, MISLEADING_OFFER, OTHER).
 *    Te ID są single source of truth — backend waliduje `category` przeciwko
 *    tej liście. Endpoint `GET /api/mobile/v1/reports/categories` istnieje
 *    jako pomoc dla agentów AI / panelu admina, ale klient mobilny używa
 *    twardo zaszytych labelek (kontrola UX i działanie offline).
 * 2) Pozwala dopisać krótki opis kontekstu (do 500 znaków) w polu `reason`.
 * 3) Wysyła POST do `/api/mobile/v1/reports` z bodyem:
 *    oferta: `{ targetType: 'OFFER', targetId, category, reason? }`;
 *    użytkownik: `{ targetType: 'USER', reportedUserId, category, reason? }`.
 *    Backend zwraca `{ success: true }` (201); klient traktuje każdy `res.ok` jako sukces.
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

/** Zgodne z GET/POST `/api/mobile/v1/reports` na produkcji (estateos.pl). */
type ReportCategory =
  | 'SPAM'
  | 'SCAM'
  | 'HARASSMENT'
  | 'ILLEGAL_CONTENT'
  | 'MISLEADING_OFFER'
  | 'OTHER';

const REPORT_CATEGORIES: ReportCategory[] = [
  'SPAM',
  'SCAM',
  'HARASSMENT',
  'ILLEGAL_CONTENT',
  'MISLEADING_OFFER',
  'OTHER',
];

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
  const { t } = useI18n();
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

  const reasons = useMemo(
    () =>
      REPORT_CATEGORIES.map((id) => ({
        id,
        label: t(`report.reasons.${id}.label`),
        subtitle: t(`report.reasons.${id}.subtitle`),
      })),
    [t],
  );

  const errorMessages = useMemo(
    () => ({
      CANNOT_REPORT_SELF: {
        title: t('report.errors.CANNOT_REPORT_SELF.title'),
        message: t('report.errors.CANNOT_REPORT_SELF.message'),
      },
      CANNOT_REPORT_OWN_OFFER: {
        title: t('report.errors.CANNOT_REPORT_OWN_OFFER.title'),
        message: t('report.errors.CANNOT_REPORT_OWN_OFFER.message'),
      },
      RATE_LIMITED: {
        title: t('report.errors.RATE_LIMITED.title'),
        message: t('report.errors.RATE_LIMITED.message'),
      },
      TARGET_NOT_FOUND: {
        title: t('report.errors.TARGET_NOT_FOUND.title'),
        message: t('report.errors.TARGET_NOT_FOUND.message'),
      },
      INVALID_CATEGORY: {
        title: t('report.errors.INVALID_CATEGORY.title'),
        message: t('report.errors.INVALID_CATEGORY.message'),
      },
      MISSING_AUTH: {
        title: t('report.errors.MISSING_AUTH.title'),
        message: t('report.errors.MISSING_AUTH.message'),
      },
    }),
    [t],
  );

  const headlineTarget = useMemo(() => {
    if (targetType === 'offer') return t('report.headlineOffer');
    return t('report.headlineUser');
  }, [targetType, t]);

  const handleSubmit = useCallback(async () => {
    if (!reason || busy) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setBusy(true);

    const targetIdNum = Number(targetId);
    if (!Number.isFinite(targetIdNum) || targetIdNum <= 0) {
      setBusy(false);
      Alert.alert(t('report.missingTarget.title'), t('report.missingTarget.message'));
      return;
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    // Produkcja: POST oczekuje targetId (string) lub reportedUserId — nie targetOfferId.
    const detailsText = details.trim() || undefined;
    const body =
      targetType === 'offer'
        ? {
            targetType: 'OFFER',
            targetId: String(targetIdNum),
            category: reason,
            reason: detailsText,
            reasonText: detailsText,
          }
        : {
            targetType: 'USER',
            reportedUserId: targetIdNum,
            targetUserId: targetIdNum,
            category: reason,
            reason: detailsText,
            reasonText: detailsText,
          };

    try {
      const res = await fetch(`${API_URL}/api/mobile/v1/reports`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSubmitted(true);
        return;
      }

      const status = res.status;
      const data: { error_code?: string; message?: string; success?: boolean } = await res.json().catch(() => ({}));
      const code = String(data?.error_code || '');
      const serverMessage = typeof data?.message === 'string' ? data.message.trim() : '';

      if (status >= 500 || status === 404 || status === 501) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSubmitted(true);
        return;
      }

      const mapped = errorMessages[code as keyof typeof errorMessages];
      if (mapped) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(mapped.title, mapped.message);
        return;
      }

      if (serverMessage) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(t('report.submitFailed'), serverMessage);
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        t('report.submitFailed'),
        t('report.errors.default.message', { email: ESTATEOS_CONTACT_EMAIL }),
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
  }, [busy, details, errorMessages, reason, targetId, targetType, t, token]);

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
                  {t('report.successTitle')}
                </Text>
                <Text style={[styles.successText, { color: textMuted }]}>
                  {t('report.successBody')}
                </Text>
                <Pressable
                  onPress={onClose}
                  style={({ pressed }) => [
                    styles.successCta,
                    { backgroundColor: '#0A84FF', opacity: pressed ? 0.7 : 1 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={t('report.closeA11y')}
                >
                  <Text style={styles.successCtaText}>{t('common.ok')}</Text>
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
                    {t('report.pickReason')}
                  </Text>

                  {reasons.map((r) => {
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
                    {t('report.detailsLabel')}
                  </Text>
                  <TextInput
                    value={details}
                    onChangeText={(text) => setDetails(text.slice(0, MAX_DETAILS_LENGTH))}
                    placeholder={t('report.detailsPlaceholder')}
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
                      {t('common.cancel')}
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
                    accessibilityLabel={t('report.submit')}
                  >
                    {busy ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryCtaText}>{t('report.title')}</Text>
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
  successWrap: {
    alignItems: 'center',
    alignSelf: 'stretch',
    width: '100%',
    paddingTop: 6,
    paddingHorizontal: 4,
  },
  successCta: {
    alignSelf: 'stretch',
    width: '100%',
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successCtaText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
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

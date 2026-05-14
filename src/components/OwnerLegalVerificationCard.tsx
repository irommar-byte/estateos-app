/**
 * ====================================================================
 *  EstateOS™ — Karta weryfikacji prawnej (widok WŁAŚCICIELA oferty)
 * ====================================================================
 *
 *  Renderowana w `OfferDetail.tsx` POD główną kartą bezpieczeństwa
 *  (`safetyBadgeCard`) — i WYŁĄCZNIE wtedy, gdy `isOwner === true`.
 *  Pełni dwie role:
 *    1. pokazuje właścicielowi aktualny stan weryfikacji prawnej
 *       (NONE / PENDING / VERIFIED / REJECTED) z czytelnym kolorem;
 *    2. udostępnia CTA do zgłoszenia / ponownego zgłoszenia numeru KW
 *       i numeru lokalu administratorowi.
 *
 *  Po zaakceptowaniu zgłoszenia przez admina backend ustawia
 *  `isLegalSafeVerified = true` na ofercie — czyli zielony znaczek
 *  „Zweryfikowano prawnie" zapali się NIEZALEŻNIE od tej karty (bo
 *  korzysta z głównego `safetyBadgeCard` powyżej). Ta karta jest
 *  niezbędna tylko dla flow autorskiego.
 */

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
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  fetchOwnerLegalVerification,
  LegalVerificationServiceError,
  submitOwnerLegalVerification,
} from '../services/legalVerificationService';
import {
  type LegalVerificationStatus,
  type OfferLegalVerificationView,
  getLegalVerificationStatusLabel,
  getRejectionReasonLabel,
} from '../contracts/legalVerificationContract';
import {
  applyLandRegistryPrefix,
  getCourtByLandRegistryPrefix,
  getLandRegistryPrefixSuggestions,
  isValidLandRegistryNumber,
  normalizeLandRegistryNumber,
} from '../utils/landRegistry';

type Props = {
  offerId: number;
  token: string | null;
  isDark: boolean;
  /**
   * Sugerowane wartości pre-fill — jeśli oferta już ma KW/apt w głównym
   * rekordzie (np. zostały wpisane podczas dodawania oferty), używamy
   * ich jako wartości startowych w formularzu. Dzięki temu właściciel
   * nie musi przepisywać po raz drugi.
   */
  initialLandRegistryNumber?: string | null;
  initialApartmentNumber?: string | null;
  /**
   * Wywoływane po SUKCESIE submit/approve — daje sygnał rodzicowi
   * (OfferDetail), że warto odświeżyć główny rekord oferty (żeby zaktualizować
   * `isLegalSafeVerified` w hero-karcie). To opcjonalne.
   */
  onStatusChanged?: (next: OfferLegalVerificationView) => void;
};

export default function OwnerLegalVerificationCard({
  offerId,
  token,
  isDark,
  initialLandRegistryNumber,
  initialApartmentNumber,
  onStatusChanged,
}: Props) {
  const [view, setView] = useState<OfferLegalVerificationView | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [formKW, setFormKW] = useState('');
  const [formApt, setFormApt] = useState('');
  const [formNote, setFormNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    if (!offerId) return;
    setLoading(true);
    try {
      const next = await fetchOwnerLegalVerification(offerId, token);
      setView(next);
    } catch (err) {
      // Jeśli endpoint jeszcze nie istnieje na backendzie / błąd sieci —
      // POKAZUJEMY stan „brak danych" zamiast crashować widok oferty.
      setView({
        offerId,
        status: 'NONE',
        landRegistryNumber: initialLandRegistryNumber || null,
        apartmentNumber: initialApartmentNumber || null,
        submittedAt: null,
        reviewedAt: null,
        reviewedByName: null,
        rejection: null,
        isLegalSafeVerified: false,
      });
    } finally {
      setLoading(false);
    }
  }, [offerId, token, initialLandRegistryNumber, initialApartmentNumber]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openSubmit = useCallback(() => {
    Haptics.selectionAsync();
    setFormKW(view?.landRegistryNumber || initialLandRegistryNumber || '');
    setFormApt(view?.apartmentNumber || initialApartmentNumber || '');
    setFormNote('');
    setSubmitOpen(true);
  }, [view?.landRegistryNumber, view?.apartmentNumber, initialLandRegistryNumber, initialApartmentNumber]);

  const closeSubmit = useCallback(() => {
    setSubmitOpen(false);
    setSubmitting(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    const kw = formKW.trim();
    const apt = formApt.trim();
    if (!isValidLandRegistryNumber(kw) || !kw) {
      Alert.alert('Walidacja', 'Numer księgi wieczystej ma niepoprawny format. Użyj wzoru: WA4N/00012345/6.');
      return;
    }
    if (!apt) {
      Alert.alert('Walidacja', 'Wpisz numer mieszkania (lub „—" dla domu jednorodzinnego).');
      return;
    }
    setSubmitting(true);
    try {
      const next = await submitOwnerLegalVerification(
        offerId,
        { landRegistryNumber: kw, apartmentNumber: apt, ownerNote: formNote.trim() || null },
        token,
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setView(next);
      onStatusChanged?.(next);
      closeSubmit();
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const msg = err instanceof LegalVerificationServiceError ? err.message : 'Nie udało się zgłosić KW do weryfikacji.';
      Alert.alert('Błąd', msg);
    } finally {
      setSubmitting(false);
    }
  }, [formKW, formApt, formNote, offerId, token, onStatusChanged, closeSubmit]);

  const kwCourtSuggest = useMemo(() => getLandRegistryPrefixSuggestions(formKW), [formKW]);
  const kwSelectedCourt = useMemo(() => getCourtByLandRegistryPrefix(formKW), [formKW]);
  const kwFormatIncomplete = useMemo(() => {
    const t = formKW.trim();
    return !t || !isValidLandRegistryNumber(t);
  }, [formKW]);

  const palette = useMemo(() => getPaletteFor(view?.status ?? 'NONE', isDark), [view?.status, isDark]);

  if (loading) {
    return (
      <View style={[styles.card, palette.cardStyle]}>
        <ActivityIndicator size="small" color={palette.accent} />
        <Text style={[styles.cardTitle, { color: palette.accent, marginTop: 6 }]}>
          Ładowanie stanu weryfikacji…
        </Text>
      </View>
    );
  }

  if (!view) return null;

  const submittedLabel = view.submittedAt
    ? new Date(view.submittedAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;
  const reviewedLabel = view.reviewedAt
    ? new Date(view.reviewedAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  // --- Wybór CTA na podstawie stanu ---
  const ctaLabel = (() => {
    switch (view.status) {
      case 'NONE':
        return 'Zgłoś KW do weryfikacji';
      case 'REJECTED':
        return 'Popraw i wyślij ponownie';
      case 'PENDING':
        return 'Edytuj zgłoszenie';
      case 'VERIFIED':
      default:
        return null;
    }
  })();

  return (
    <>
      <View style={[styles.card, palette.cardStyle]}>
        <View style={styles.headerRow}>
          <View style={[styles.iconWrap, { backgroundColor: palette.iconBg }]}>
            <Ionicons name={palette.icon as any} size={18} color={palette.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: palette.accent }]} numberOfLines={1}>
              {getLegalVerificationStatusLabel(view.status)}
            </Text>
            <Text style={[styles.cardSub, { color: isDark ? '#9ca3af' : '#6b7280' }]} numberOfLines={4}>
              {getOwnerHelperText(view, submittedLabel, reviewedLabel)}
            </Text>
          </View>
        </View>

        {view.status === 'REJECTED' && view.rejection ? (
          <View style={[styles.rejectionBox, { borderColor: '#ef4444', backgroundColor: isDark ? 'rgba(239,68,68,0.10)' : 'rgba(239,68,68,0.08)' }]}>
            <Text style={[styles.rejectionLabel, { color: '#ef4444' }]}>Powód odrzucenia</Text>
            <Text style={[styles.rejectionReason, { color: isDark ? '#fecaca' : '#7f1d1d' }]}>
              {getRejectionReasonLabel(view.rejection.reasonCode)}
            </Text>
            {view.rejection.reasonText ? (
              <Text style={[styles.rejectionText, { color: isDark ? '#fecaca' : '#991b1b' }]}>
                „{view.rejection.reasonText}”
              </Text>
            ) : null}
          </View>
        ) : null}

        {ctaLabel ? (
          <Pressable
            onPress={openSubmit}
            style={({ pressed }) => [
              styles.ctaButton,
              { backgroundColor: palette.accent, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Ionicons name="paper-plane-outline" size={14} color="#FFFFFF" />
            <Text style={styles.ctaText}>{ctaLabel}</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Bottom sheet z formularzem KW + apt + notatka */}
      <Modal visible={submitOpen} transparent animationType="fade" onRequestClose={closeSubmit}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 56 : 0}
        >
          <View style={{ flex: 1, justifyContent: 'flex-end' }}>
            <Pressable style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.45)' }]} onPress={closeSubmit} />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="none"
              bounces={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end', paddingBottom: 8 }}
            >
              <View style={[styles.sheet, { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }]}>
                <Text style={[styles.sheetTitle, { color: isDark ? '#FFFFFF' : '#1d1d1f' }]}>
                  Zgłoszenie weryfikacji prawnej
                </Text>
                <Text style={[styles.sheetSub, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                  Administrator EstateOS™ porówna podane dane z EKW i — jeśli wszystko się zgadza —
                  na karcie oferty zapali się zielony znaczek „Zweryfikowano prawnie”.
                </Text>

                <Text style={[styles.fieldLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                  Numer księgi wieczystej
                </Text>
                <TextInput
                  value={formKW}
                  onChangeText={(t) => setFormKW(normalizeLandRegistryNumber(t))}
                  placeholder="WA4N/00012345/6"
                  placeholderTextColor={isDark ? '#52525b' : '#9ca3af'}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  style={[
                    styles.input,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                      color: isDark ? '#FFFFFF' : '#1d1d1f',
                      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                    },
                  ]}
                />
                {kwCourtSuggest.length > 0 && kwFormatIncomplete ? (
                  <View
                    style={[
                      styles.suggestionsWrap,
                      {
                        borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
                        backgroundColor: isDark ? '#111214' : '#F8FAFC',
                      },
                    ]}
                  >
                    {kwCourtSuggest.map((item) => (
                      <Pressable
                        key={item.prefix}
                        style={styles.suggestionRow}
                        onPress={() => setFormKW(applyLandRegistryPrefix(formKW, item.prefix))}
                      >
                        <Text style={[styles.suggestionPrefix, { color: isDark ? '#FFFFFF' : '#1d1d1f' }]}>{item.prefix}</Text>
                        <Text style={[styles.suggestionCourt, { color: isDark ? '#9ca3af' : '#6b7280' }]} numberOfLines={2}>
                          {item.courtName}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                {kwSelectedCourt ? (
                  <Text style={[styles.courtHint, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                    Właściwy sąd: {kwSelectedCourt.courtName}
                  </Text>
                ) : null}

                <Text style={[styles.fieldLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                  Numer mieszkania
                </Text>
                <TextInput
                  value={formApt}
                  onChangeText={setFormApt}
                  placeholder='np. „14A" lub „—" dla domu'
                  placeholderTextColor={isDark ? '#52525b' : '#9ca3af'}
                  style={[
                    styles.input,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                      color: isDark ? '#FFFFFF' : '#1d1d1f',
                      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                    },
                  ]}
                />

                <Text style={[styles.fieldLabel, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                  Notatka do administratora (opcjonalnie)
                </Text>
                <TextInput
                  value={formNote}
                  onChangeText={setFormNote}
                  placeholder="np. „Numer KW po obu rodzicach, dział II zaktualizowany w 2024 r."
                  placeholderTextColor={isDark ? '#52525b' : '#9ca3af'}
                  multiline
                  numberOfLines={3}
                  style={[
                    styles.input,
                    styles.inputMultiline,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                      color: isDark ? '#FFFFFF' : '#1d1d1f',
                      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                    },
                  ]}
                />

                <View style={styles.sheetActions}>
                  <Pressable
                    onPress={closeSubmit}
                    style={({ pressed }) => [
                      styles.cancelBtn,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                        opacity: pressed ? 0.78 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.cancelBtnText, { color: isDark ? '#FFFFFF' : '#1d1d1f' }]}>
                      Anuluj
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleSubmit}
                    disabled={submitting}
                    style={({ pressed }) => [
                      styles.submitBtn,
                      { opacity: submitting ? 0.65 : pressed ? 0.85 : 1 },
                    ]}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.submitBtnText}>Wyślij do weryfikacji</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// --------------------------------------------------------------------
//  Pomocnicze: paleta i tekst pomocniczy
// --------------------------------------------------------------------

function getPaletteFor(status: LegalVerificationStatus, isDark: boolean) {
  switch (status) {
    case 'VERIFIED':
      return {
        accent: '#10b981',
        iconBg: isDark ? 'rgba(16,185,129,0.18)' : 'rgba(16,185,129,0.12)',
        icon: 'shield-checkmark',
        cardStyle: {
          borderColor: isDark ? 'rgba(16,185,129,0.45)' : 'rgba(16,185,129,0.35)',
          backgroundColor: isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.05)',
        },
      };
    case 'PENDING':
      return {
        accent: '#f59e0b',
        iconBg: isDark ? 'rgba(245,158,11,0.18)' : 'rgba(245,158,11,0.12)',
        icon: 'hourglass-outline',
        cardStyle: {
          borderColor: isDark ? 'rgba(245,158,11,0.45)' : 'rgba(245,158,11,0.35)',
          backgroundColor: isDark ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.05)',
        },
      };
    case 'REJECTED':
      return {
        accent: '#ef4444',
        iconBg: isDark ? 'rgba(239,68,68,0.18)' : 'rgba(239,68,68,0.12)',
        icon: 'alert-circle-outline',
        cardStyle: {
          borderColor: isDark ? 'rgba(239,68,68,0.45)' : 'rgba(239,68,68,0.35)',
          backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.05)',
        },
      };
    case 'NONE':
    default:
      return {
        accent: '#007AFF',
        iconBg: isDark ? 'rgba(0,122,255,0.18)' : 'rgba(0,122,255,0.12)',
        icon: 'shield-outline',
        cardStyle: {
          borderColor: isDark ? 'rgba(0,122,255,0.45)' : 'rgba(0,122,255,0.30)',
          backgroundColor: isDark ? 'rgba(0,122,255,0.08)' : 'rgba(0,122,255,0.05)',
        },
      };
  }
}

function getOwnerHelperText(
  view: OfferLegalVerificationView,
  submittedLabel: string | null,
  reviewedLabel: string | null,
): string {
  switch (view.status) {
    case 'VERIFIED':
      return reviewedLabel
        ? `Zatwierdzono ${reviewedLabel}${view.reviewedByName ? ` · ${view.reviewedByName}` : ''}`
        : 'Zatwierdzono przez administratora EstateOS™.';
    case 'PENDING':
      return submittedLabel
        ? `Zgłoszono ${submittedLabel} · czeka na admina`
        : 'Zgłoszenie czeka na administratora.';
    case 'REJECTED':
      return 'Zgłoszenie zostało odrzucone — popraw dane i wyślij ponownie.';
    case 'NONE':
    default:
      return 'Wyślij numer KW i numer lokalu, by zapalił się zielony znaczek bezpieczeństwa.';
  }
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1.4,
    padding: 14,
    marginTop: 0,
    marginBottom: 0,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 14, fontWeight: '900', letterSpacing: 0.2 },
  cardSub: { fontSize: 12, fontWeight: '600', marginTop: 2, lineHeight: 16 },
  rejectionBox: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
  },
  rejectionLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  rejectionReason: { fontSize: 13, fontWeight: '800', marginTop: 2 },
  rejectionText: { fontSize: 12, fontWeight: '500', marginTop: 4, fontStyle: 'italic' },

  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 14,
  },
  ctaText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', letterSpacing: 0.3 },

  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 36,
  },
  sheetTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.2 },
  sheetSub: { fontSize: 12, fontWeight: '600', marginTop: 4, lineHeight: 17 },

  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '600',
  },
  inputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },

  suggestionsWrap: {
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    overflow: 'hidden',
  },
  suggestionRow: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.2)',
  },
  suggestionPrefix: { fontSize: 13, fontWeight: '800', letterSpacing: 0.4 },
  suggestionCourt: { marginTop: 2, fontSize: 12, fontWeight: '500' },
  courtHint: { marginTop: 8, fontSize: 12, fontWeight: '600' },

  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  cancelBtnText: { fontSize: 14, fontWeight: '800' },
  submitBtn: {
    flex: 1.4,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#34C759',
  },
  submitBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 0.2 },
});

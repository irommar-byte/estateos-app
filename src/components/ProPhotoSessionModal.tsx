import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { useI18n } from '../i18n';
import { useAuthStore } from '../store/useAuthStore';
import { isInvestorProIdentity } from '../utils/partnerIdentity';
import {
  createPhotoSessionRequest,
  fetchMyPhotoSessionRequests,
  type PhotoSessionRequestItem,
} from '../services/photoSessionService';
import ProPhotoSessionExamples from './ProPhotoSessionExampleCard';
import type { ProPhotoSessionExampleId } from './ProPhotoSessionExampleCard';
import { getProPhotoSessionSampleOffer } from '../data/proPhotoSessionSampleOffers';
import { navigationRef } from '../../navigationRef';
import { StackActions } from '@react-navigation/native';

type Theme = {
  background: string;
  text: string;
  subtitle: string;
  glass: 'dark' | 'light';
};

type DraftContext = {
  city?: string;
  district?: string;
  street?: string;
  propertyType?: string;
  transactionType?: string;
  offerTitle?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  theme: Theme;
  draft?: DraftContext;
  initialNote?: string;
  /** Gdy modal jest już w Profilu — omija navigate i otwiera listę sesji bez zablokowanej warstwy. */
  onOpenPhotoSessions?: () => void;
};

function buildNextDays() {
  return Array.from({ length: 30 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d;
  });
}

function buildHours() {
  const arr: string[] = [];
  for (let h = 8; h <= 20; h += 1) {
    arr.push(`${String(h).padStart(2, '0')}:00`);
    if (h !== 20) arr.push(`${String(h).padStart(2, '0')}:30`);
  }
  return arr;
}

function buildPropertyLabel(draft?: DraftContext) {
  const parts = [draft?.offerTitle, draft?.city, draft?.district, draft?.street]
    .map((x) => String(x || '').trim())
    .filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

export default function ProPhotoSessionModal({
  visible,
  onClose,
  theme,
  draft,
  initialNote,
  onOpenPhotoSessions,
}: Props) {
  const { t } = useI18n();
  const navigation = useNavigation<any>();
  const { token, user } = useAuthStore() as any;
  const isDark = theme.glass === 'dark';
  const isInvestorPro = isInvestorProIdentity(user);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedHour, setSelectedHour] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [activeRequest, setActiveRequest] = useState<PhotoSessionRequestItem | null>(null);
  const [loadingRequest, setLoadingRequest] = useState(false);

  const dates = useMemo(() => buildNextDays(), []);
  const hours = useMemo(() => buildHours(), []);
  const safeToken = useMemo(() => {
    const trimmed = String(token || '').trim();
    if (!trimmed) return null;
    return trimmed.startsWith('Bearer ') ? trimmed.slice('Bearer '.length).trim() : trimmed;
  }, [token]);

  useEffect(() => {
    if (!visible) return;
    setStep(1);
    setSelectedDate(null);
    setSelectedHour(null);
    setNote(String(initialNote || '').trim());
    setError(null);
    setSuccess(false);
    if (!safeToken) {
      setActiveRequest(null);
      return;
    }
    setLoadingRequest(true);
    fetchMyPhotoSessionRequests(safeToken)
      .then((items) => {
        const pending = items.find((x) => x.status === 'PENDING') || null;
        setActiveRequest(pending);
        if (pending?.status === 'ACCEPTED') setSuccess(true);
      })
      .catch(() => setActiveRequest(null))
      .finally(() => setLoadingRequest(false));
  }, [visible, safeToken, initialNote]);

  const hasActivePending = activeRequest?.status === 'PENDING';
  const pendingNeedsUser = hasActivePending && activeRequest?.waitingOn === 'USER';

  const canAdvance =
    step === 1
      ? Boolean(selectedDate)
      : step === 2
        ? Boolean(selectedHour)
        : Boolean(selectedDate && selectedHour);

  const selectedLabel = useMemo(() => {
    if (!selectedDate || !selectedHour) return '';
    return t('addOffer.step5.proSession.selectedAt', {
      date: selectedDate.toLocaleDateString('pl-PL'),
      hour: selectedHour,
    });
  }, [selectedDate, selectedHour, t]);

  const handleSubmit = async () => {
    if (!selectedDate || !selectedHour || loading || success) return;
    if (!safeToken) {
      setError(t('addOffer.step5.proSession.errors.loginRequired'));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [hh, mm] = selectedHour.split(':');
      const dt = new Date(selectedDate);
      dt.setHours(Number(hh), Number(mm), 0, 0);

      await createPhotoSessionRequest(
        {
          proposedAt: dt.toISOString(),
          note: note.trim() || undefined,
          propertyLabel: buildPropertyLabel(draft) || undefined,
          propertyType: draft?.propertyType || undefined,
          transactionType: draft?.transactionType || undefined,
        },
        safeToken,
      );

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccess(true);
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const status = Number(err?.status || 0);
      if (status === 401) {
        setError(t('addOffer.step5.proSession.errors.loginRequired'));
      } else if (status === 404 || status === 405) {
        setError(t('addOffer.step5.proSession.errors.serviceUnavailable'));
      } else if (!status) {
        setError(t('addOffer.step5.proSession.errors.network'));
      } else {
        setError(err?.message || t('addOffer.step5.proSession.errors.submitFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitPress = () => {
    if (loading || success) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (step === 1) {
      if (!selectedDate) {
        setError(t('addOffer.step5.proSession.errors.pickDateTime'));
        return;
      }
      setError(null);
      setStep(2);
      return;
    }

    if (step === 2) {
      if (!selectedHour) {
        setError(t('addOffer.step5.proSession.errors.pickDateTime'));
        return;
      }
      setError(null);
      setStep(3);
      return;
    }

    if (!safeToken) {
      setError(t('addOffer.step5.proSession.errors.loginRequired'));
      return;
    }
    if (!selectedDate || !selectedHour) {
      setError(t('addOffer.step5.proSession.errors.pickDateTime'));
      return;
    }

    void handleSubmit();
  };

  const handleOpenPhotoSessions = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
    setTimeout(() => {
      if (onOpenPhotoSessions) {
        onOpenPhotoSessions();
        return;
      }
      if (navigationRef.isReady()) {
        navigationRef.navigate('MainTabs', {
          screen: 'Profil',
          params: { openPhotoSessions: true },
        });
        return;
      }
      navigation.navigate('Profil', { openPhotoSessions: true });
    }, 280);
  };

  const handleBecomePro = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
    navigation.navigate('Profil', { openShop: true });
  };

  const handleOpenSampleOffer = (sampleId: ProPhotoSessionExampleId) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const offer = getProPhotoSessionSampleOffer(sampleId, t);
    onClose();
    setTimeout(() => {
      if (navigationRef.isReady()) {
        navigationRef.dispatch(
          StackActions.push('OfferDetail', {
            offer,
            isSamplePreview: true,
          }),
        );
        return;
      }
      navigation.navigate('OfferDetail', { offer, isSamplePreview: true });
    }, 140);
  };

  const cardBg = isDark ? '#111113' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const muted = isDark ? '#9da0a6' : '#6b7280';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 16 : 0}
          style={styles.keyboardWrap}
        >
          <View style={[styles.card, { backgroundColor: isDark ? '#0b0b0b' : '#fafafa', borderColor: cardBorder }]}>
            <View style={styles.headerRow}>
              {step > 1 && !success ? (
                <TouchableOpacity
                  style={[styles.backBtn, { borderColor: cardBorder }]}
                  onPress={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}
                >
                  <Ionicons name="chevron-back" size={16} color={theme.text} />
                </TouchableOpacity>
              ) : (
                <View style={styles.headerPlaceholder} />
              )}
              <TouchableOpacity style={[styles.closeBtn, { borderColor: cardBorder }]} onPress={onClose}>
                <Ionicons name="close" size={16} color={theme.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.eyebrow, { color: muted }]}>{t('addOffer.step5.proSession.eyebrow')}</Text>
            <Text style={[styles.title, { color: theme.text }]}>{t('addOffer.step5.proSession.title')}</Text>
            <Text style={[styles.subtitle, { color: theme.subtitle }]}>{t('addOffer.step5.proSession.subtitle')}</Text>

            {!safeToken && !success ? (
              <View
                style={[
                  styles.loginBanner,
                  {
                    backgroundColor: isDark ? 'rgba(255,159,10,0.12)' : 'rgba(255,159,10,0.08)',
                    borderColor: isDark ? 'rgba(255,159,10,0.35)' : 'rgba(255,159,10,0.25)',
                  },
                ]}
              >
                <Text style={[styles.loginBannerText, { color: isDark ? '#FFD79A' : '#B45309' }]}>
                  {t('addOffer.step5.proSession.loginBanner')}
                </Text>
              </View>
            ) : null}

            <ScrollView
              style={styles.content}
              contentContainerStyle={styles.contentInner}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {loadingRequest ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator color="#10b981" />
                </View>
              ) : success ? (
                <View style={[styles.successBox, { backgroundColor: isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.35)' }]}>
                  <Ionicons name="checkmark-circle" size={42} color="#10b981" />
                  <Text style={[styles.successTitle, { color: theme.text }]}>{t('addOffer.step5.proSession.successTitle')}</Text>
                  <Text style={[styles.successBody, { color: theme.subtitle }]}>
                    {activeRequest?.proposedAt
                      ? t('addOffer.step5.proSession.successBody', {
                          label: new Date(activeRequest.proposedAt).toLocaleString('pl-PL'),
                        })
                      : t('addOffer.step5.proSession.successBody', { label: selectedLabel })}
                  </Text>
                  <Text style={[styles.successHint, { color: theme.subtitle }]}>
                    {t('addOffer.step5.proSession.manageInProfile')}
                  </Text>
                  <TouchableOpacity onPress={handleOpenPhotoSessions} style={styles.manageSessionsBtn}>
                    <Text style={styles.manageSessionsBtnText}>{t('addOffer.step5.proSession.openPhotoSessions')}</Text>
                  </TouchableOpacity>
                </View>
              ) : hasActivePending && activeRequest ? (
                <View style={[styles.negotiationBox, { backgroundColor: isDark ? 'rgba(14,165,233,0.12)' : 'rgba(14,165,233,0.08)', borderColor: 'rgba(14,165,233,0.35)' }]}>
                  <Ionicons name="calendar-outline" size={32} color="#0ea5e9" />
                  <Text style={[styles.negotiationTitle, { color: theme.text }]}>
                    {pendingNeedsUser
                      ? t('addOffer.step5.proSession.activeCounterTitle')
                      : t('addOffer.step5.proSession.activePendingTitle')}
                  </Text>
                  <Text style={[styles.negotiationBody, { color: theme.subtitle }]}>
                    {new Date(activeRequest.proposedAt).toLocaleString('pl-PL')}
                  </Text>
                  <Text style={[styles.negotiationHint, { color: theme.subtitle }]}>
                    {pendingNeedsUser
                      ? t('addOffer.step5.proSession.activeCounterHint')
                      : t('addOffer.step5.proSession.activePendingHint')}
                  </Text>
                  <TouchableOpacity onPress={handleOpenPhotoSessions} style={styles.manageSessionsBtn}>
                    <Text style={styles.manageSessionsBtnText}>{t('addOffer.step5.proSession.openPhotoSessions')}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Text style={[styles.sectionLabel, { color: muted }]}>{t('addOffer.step5.proSession.examplesTitle')}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.examplesRow}>
                    <ProPhotoSessionExamples
                      borderColor={cardBorder}
                      textColor={theme.text}
                      subtitleColor={theme.subtitle}
                      isDark={isDark}
                      onSelectSample={handleOpenSampleOffer}
                    />
                  </ScrollView>

                  <View style={[styles.pricingCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                    <View style={styles.pricingRow}>
                      <Text style={[styles.pricingLabel, { color: muted }]}>{t('addOffer.step5.proSession.priceLabel')}</Text>
                      <Text style={[styles.pricingValue, { color: theme.text }]}>199 zł</Text>
                    </View>
                    <Text style={[styles.pricingHint, { color: theme.subtitle }]}>{t('addOffer.step5.proSession.priceHint')}</Text>
                    <View style={[styles.proBenefitBox, { backgroundColor: isDark ? 'rgba(168,85,247,0.1)' : 'rgba(168,85,247,0.06)', borderColor: isDark ? 'rgba(168,85,247,0.28)' : 'rgba(168,85,247,0.18)' }]}>
                      <Ionicons name="ribbon-outline" size={16} color="#a855f7" />
                      <Text style={[styles.proBenefitText, { color: theme.text }]}>
                        {isInvestorPro ? t('addOffer.step5.proSession.proFreeActive') : t('addOffer.step5.proSession.proBenefit')}
                      </Text>
                    </View>
                    {!isInvestorPro ? (
                      <TouchableOpacity onPress={handleBecomePro} activeOpacity={0.9} style={styles.becomeProBtnWrap}>
                        <LinearGradient
                          colors={isDark ? ['#4c1d95', '#7c3aed', '#a855f7'] : ['#6d28d9', '#8b5cf6', '#a78bfa']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.becomeProBtn}
                        >
                          <Ionicons name="diamond" size={16} color="#fff" />
                          <Text style={styles.becomeProBtnText}>{t('addOffer.step5.proSession.becomePro')}</Text>
                          <Ionicons name="arrow-forward" size={15} color="rgba(255,255,255,0.92)" />
                        </LinearGradient>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                    <View style={styles.stepHeader}>
                      <Text style={[styles.stepTitle, { color: theme.text }]}>
                        {step === 1
                          ? t('addOffer.step5.proSession.steps.pickDay')
                          : step === 2
                            ? t('addOffer.step5.proSession.steps.pickHour')
                            : t('addOffer.step5.proSession.steps.confirm')}
                      </Text>
                      <Text style={[styles.stepSub, { color: muted }]}>{t('addOffer.step5.proSession.steps.progress', { step })}</Text>
                    </View>

                    {step === 1 && (
                      <View style={styles.calendarGrid}>
                        {dates.map((d) => {
                          const selected = selectedDate?.toDateString() === d.toDateString();
                          return (
                            <TouchableOpacity
                              key={d.toISOString()}
                              onPress={() => {
                                setSelectedDate(d);
                                setStep(2);
                              }}
                              style={[
                                styles.calendarDayCard,
                                { borderColor: cardBorder, backgroundColor: isDark ? '#141418' : '#f3f4f6' },
                                selected && styles.calendarDayCardActive,
                              ]}
                            >
                              <Text style={[styles.calendarDayWeek, selected && styles.calendarDayWeekActive]}>
                                {d.toLocaleDateString('pl-PL', { weekday: 'short' }).replace('.', '')}
                              </Text>
                              <Text style={[styles.calendarDayNum, { color: theme.text }, selected && styles.calendarDayNumActive]}>
                                {d.getDate()}
                              </Text>
                              <Text style={[styles.calendarDayMonth, { color: muted }, selected && styles.calendarDayMonthActive]}>
                                {d.toLocaleDateString('pl-PL', { month: 'short' }).replace('.', '')}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}

                    {step === 2 && (
                      <View style={styles.hoursGrid}>
                        {hours.map((h) => {
                          const selected = selectedHour === h;
                          return (
                            <TouchableOpacity
                              key={h}
                              onPress={() => {
                                setSelectedHour(h);
                                setStep(3);
                              }}
                              style={[
                                styles.hourTile,
                                { borderColor: cardBorder, backgroundColor: isDark ? '#141418' : '#f3f4f6' },
                                selected && styles.hourTileActive,
                              ]}
                            >
                              <Text style={[styles.hourTileText, { color: theme.text }, selected && styles.hourTileTextActive]}>{h}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}

                    {step === 3 && (
                      <>
                        <View style={[styles.selectedTermCard, { backgroundColor: isDark ? '#141418' : '#f3f4f6', borderColor: cardBorder }]}>
                          <Text style={[styles.selectedTermLabel, { color: muted }]}>{t('addOffer.step5.proSession.selectedLabel')}</Text>
                          <Text style={[styles.selectedTermValue, { color: theme.text }]}>{selectedLabel}</Text>
                        </View>
                        <Text style={[styles.sectionLabel, { color: muted, marginTop: 12 }]}>{t('addOffer.step5.proSession.noteLabel')}</Text>
                        <TextInput
                          value={note}
                          onChangeText={setNote}
                          placeholder={t('addOffer.step5.proSession.notePlaceholder')}
                          placeholderTextColor={muted}
                          style={[
                            styles.noteInput,
                            {
                              color: theme.text,
                              backgroundColor: isDark ? '#141418' : '#f9fafb',
                              borderColor: cardBorder,
                            },
                          ]}
                          multiline
                        />
                      </>
                    )}
                  </View>
                </>
              )}
            </ScrollView>

            {!!error && <Text style={styles.error}>{error}</Text>}

            <View style={styles.footerRow}>
              <TouchableOpacity style={[styles.secondaryBtn, { borderColor: cardBorder }]} onPress={onClose}>
                <Text style={[styles.secondaryTxt, { color: theme.text }]}>
                  {success || hasActivePending ? t('addOffer.common.close') : t('common.cancel')}
                </Text>
              </TouchableOpacity>
              {!success && !hasActivePending ? (
                <TouchableOpacity
                  style={[styles.primaryBtn, !canAdvance && styles.disabled]}
                  onPress={handleSubmitPress}
                  disabled={loading || !canAdvance}
                >
                  {loading ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <Text style={styles.primaryTxt}>
                      {step === 3 ? t('addOffer.step5.proSession.submit') : t('addOffer.step5.proSession.next')}
                    </Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', justifyContent: 'center', padding: 10 },
  keyboardWrap: { width: '100%', justifyContent: 'center' },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: '96%',
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  headerPlaceholder: { width: 30, height: 30 },
  backBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.3, textTransform: 'uppercase' },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.3, marginTop: 4 },
  subtitle: { fontSize: 13, fontWeight: '500', lineHeight: 18, marginTop: 6, marginBottom: 10 },
  loginBanner: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  loginBannerText: { fontSize: 12, fontWeight: '700', lineHeight: 17, textAlign: 'center' },
  loadingBox: { paddingVertical: 28, alignItems: 'center' },
  negotiationBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  negotiationTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  negotiationBody: { fontSize: 15, fontWeight: '800', textAlign: 'center' },
  negotiationHint: { fontSize: 12, fontWeight: '500', textAlign: 'center', lineHeight: 17 },
  respondRow: { flex: 2, flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' },
  respondBtn: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  respondDeclineText: { color: '#ef4444', fontSize: 12, fontWeight: '800' },
  respondCounterText: { color: '#0ea5e9', fontSize: 12, fontWeight: '800' },
  respondAcceptBtn: { minWidth: 92, flex: 0 },
  content: { marginTop: 2 },
  contentInner: { paddingBottom: 8 },
  sectionLabel: { fontSize: 11, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  examplesRow: { paddingBottom: 14, paddingRight: 4 },
  pricingCard: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12 },
  pricingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pricingLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  pricingValue: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  pricingHint: { fontSize: 12, fontWeight: '500', marginTop: 6, lineHeight: 17 },
  proBenefitBox: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  proBenefitText: { flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 17 },
  becomeProBtnWrap: { marginTop: 12 },
  becomeProBtn: {
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  becomeProBtnText: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 0.2 },
  sectionCard: { borderRadius: 14, borderWidth: 1, padding: 10, marginBottom: 10 },
  stepHeader: { marginBottom: 10 },
  stepTitle: { fontSize: 17, fontWeight: '800' },
  stepSub: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  calendarDayCard: {
    width: '18.5%',
    minWidth: 54,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  calendarDayCardActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  calendarDayWeek: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', color: '#9da0a6' },
  calendarDayWeekActive: { color: 'rgba(255,255,255,0.9)' },
  calendarDayNum: { fontSize: 16, fontWeight: '900', marginTop: 2 },
  calendarDayNumActive: { color: '#fff' },
  calendarDayMonth: { fontSize: 9, fontWeight: '700', marginTop: 1 },
  calendarDayMonthActive: { color: 'rgba(255,255,255,0.9)' },
  hoursGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hourTile: {
    width: '23%',
    minWidth: 68,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  hourTileActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
  hourTileText: { fontSize: 13, fontWeight: '800' },
  hourTileTextActive: { color: '#fff' },
  selectedTermCard: { borderRadius: 12, borderWidth: 1, padding: 12 },
  selectedTermLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  selectedTermValue: { fontSize: 15, fontWeight: '800', marginTop: 4 },
  noteInput: {
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 72,
    padding: 12,
    fontSize: 14,
    fontWeight: '500',
    textAlignVertical: 'top',
  },
  successBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  successTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  successBody: { fontSize: 13, fontWeight: '500', textAlign: 'center', lineHeight: 18 },
  successHint: { fontSize: 12, fontWeight: '600', textAlign: 'center', lineHeight: 17, marginTop: 8 },
  manageSessionsBtn: {
    marginTop: 12,
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  manageSessionsBtnText: { color: '#000', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  error: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 8,
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  footerRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  secondaryBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryTxt: { fontSize: 14, fontWeight: '700' },
  primaryBtn: {
    flex: 1.4,
    borderRadius: 14,
    backgroundColor: '#10b981',
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryTxt: { color: '#000', fontSize: 14, fontWeight: '900' },
  disabled: { opacity: 0.45 },
});

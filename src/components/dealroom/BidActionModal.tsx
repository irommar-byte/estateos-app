import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { X, Minus, Plus, Banknote, CreditCard } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { API_URL } from '../../config/network';
import { archiveOfferAfterSaleClosed } from '../../utils/mobileOfferArchive';
import { postDealroomTextMessage } from '../../utils/dealroomOfferReserve';
import { useI18n } from '../../i18n';
import { isMessageFromUser } from '../../utils/dealBidNegotiation';

const QUICK_BID_STEPS = [-5000, 5000] as const;

type BidMode = 'create' | 'counter' | 'respond';
type BidDecision = 'ACCEPT' | 'REJECT' | 'COUNTER';

interface BidActionModalProps {
  visible: boolean;
  mode: BidMode;
  dealId: number | null;
  token: string | null;
  title?: string;
  bidId?: number | null;
  initialAmount?: number | null;
  eventAction?: string | null;
  quickAccept?: boolean;
  history?: Array<{
    action?: string;
    amount?: number | null;
    note?: string | null;
    /** ID użytkownika, który wysłał event — wymagane do detekcji „pending od
     *  mojej strony" (gdy ostatnia kontroferta jest moja, blokujemy wysyłkę). */
    senderId?: number | string | null;
  }>;
  /** ID zalogowanego użytkownika — używane do wykrywania, czy ostatni event
   *  w historii pochodzi od nas (wtedy blokujemy wysyłanie kolejnej kontroferty). */
  myUserId?: number | string | null;
  onClose: () => void;
  onDone?: () => void;
  /** Właściciel listingu — przy akceptacji ceny pytamy o wycofanie z publikacji (rezerwacja). */
  offerId?: number | null;
  userId?: number | null;
  isListingOwner?: boolean;
  /** Dodatkowy bezpiecznik: id właściciela listingu (z deala / oferty). */
  listingOwnerUserId?: number | string | null;
}

function normalizeToken(rawToken: string | null) {
  if (!rawToken) return null;
  const trimmed = rawToken.trim();
  if (!trimmed) return null;
  return trimmed.startsWith('Bearer ') ? trimmed.slice('Bearer '.length).trim() : trimmed;
}

function formatAmountInput(value: string) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('pl-PL');
}

function formatCurrency(value?: number | null) {
  return `${Number(value || 0).toLocaleString('pl-PL')} PLN`;
}

export default function BidActionModal({
  visible,
  mode,
  dealId,
  token,
  title,
  bidId,
  initialAmount,
  eventAction,
  quickAccept = false,
  history = [],
  myUserId = null,
  onClose,
  onDone,
  offerId = null,
  userId = null,
  isListingOwner = false,
  listingOwnerUserId = null,
}: BidActionModalProps) {
  const { t } = useI18n();
  const [amount, setAmount] = useState(initialAmount ? String(Math.round(initialAmount)) : '');
  const [note, setNote] = useState('');
  const [financing, setFinancing] = useState<'CASH' | 'CREDIT'>('CASH');
  const [decision, setDecision] = useState<BidDecision>('COUNTER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [withdrawPromptVisible, setWithdrawPromptVisible] = useState(false);
  const [ownerFinalConsent, setOwnerFinalConsent] = useState(false);

  const isLocked = useMemo(
    () => mode === 'respond' && String(eventAction || '').toUpperCase() === 'ACCEPTED',
    [mode, eventAction]
  );

  /**
   * „Pending od mojej strony" — moja ostatnia kontroferta cenowa czeka na
   * decyzję drugiej strony. W tym stanie backend zwróci 400 „już rozpatrzona",
   * więc blokujemy submit + pokazujemy spokojny banner zamiast formularza.
   */
  const isWaitingForOther = useMemo(() => {
    if (mode !== 'respond') return false;
    if (myUserId == null || !history.length) return false;
    const myId = Number(myUserId);
    if (!Number.isFinite(myId) || myId <= 0) return false;
    const last = history[history.length - 1];
    const action = String(last?.action || '').toUpperCase();
    if (!['PROPOSED', 'COUNTERED'].includes(action)) return false;
    return isMessageFromUser({ senderId: last?.senderId }, myId);
  }, [mode, myUserId, history]);

  // Bezpiecznik roli: jeśli `isListingOwner` przyszło błędnie z ekranu,
  // próbujemy ustalić rolę po ID właściciela i ID zalogowanego usera.
  const effectiveIsListingOwner = useMemo(() => {
    if (isListingOwner) return true;
    const meId = Number(myUserId ?? 0);
    const ownerId = Number(listingOwnerUserId ?? 0);
    if (!Number.isFinite(meId) || meId <= 0) return false;
    if (!Number.isFinite(ownerId) || ownerId <= 0) return false;
    return meId === ownerId;
  }, [isListingOwner, myUserId, listingOwnerUserId]);

  useEffect(() => {
    if (!visible) return;
    setAmount(initialAmount ? String(Math.round(initialAmount)) : '');
    setNote('');
    setFinancing('CASH');
    setDecision(quickAccept ? 'ACCEPT' : 'COUNTER');
    setError(null);
    setWithdrawPromptVisible(false);
    setOwnerFinalConsent(false);
    setConfirmVisible(false);
  }, [visible, initialAmount, quickAccept]);

  /**
   * Szybka korekta kwoty kontroferty/propozycji o stałe kroki.
   * Nie rusza inputu, jeśli modal jest zablokowany/ładowany, i nie pozwala
   * zejść poniżej zera. Drobny haptic feedback dla wrażenia "klawisza".
   */
  const adjustAmount = (delta: number) => {
    if (isLocked || loading) return;
    if (isWaitingForOther && decision === 'COUNTER') return;
    const current = Number(String(amount || '').replace(/\D/g, '')) || 0;
    const next = Math.max(0, current + delta);
    if (next === current) return;
    setAmount(String(next));
    try { void Haptics.selectionAsync(); } catch { /* no-op */ }
  };

  const normalizedBidId = useMemo(() => {
    if (bidId === null || bidId === undefined) return null;
    const n = Number(bidId);
    return Number.isFinite(n) ? n : null;
  }, [bidId]);

  const canSubmit = useMemo(() => {
    const safeToken = normalizeToken(token);
    if (!dealId || !safeToken || isLocked) return false;
    if (mode === 'respond') {
      if (!normalizedBidId) return false;
      // Pending od mojej strony blokuje tylko kontrofertę. „Zgoda" / „Odrzuć"
      // wciąż możliwe — to reakcja na PARTNERA, nie próba dorzucenia kolejnej
      // mojej propozycji na stos.
      if (isWaitingForOther && decision === 'COUNTER') return false;
      if (decision !== 'COUNTER') return true;
    }
    return amount.trim().length > 0;
  }, [dealId, token, mode, normalizedBidId, decision, amount, isLocked, isWaitingForOther]);

  const submitInner = async (finalizeOwnerAccept: boolean = false) => {
    const safeToken = normalizeToken(token);
    if (!dealId || !safeToken || !canSubmit || isLocked) return;
    setLoading(true);
    setError(null);
    try {
      const endpoint = `${API_URL}/api/mobile/v1/deals/${dealId}/actions`;
      const payload: any = {};
      if (mode === 'create') {
        payload.type = 'BID_PROPOSE';
        payload.amount = Number(amount.replace(/\D/g, ''));
        payload.financing = financing;
        payload.message = note;
        payload.note = note;
      } else {
        // KLUCZOWA REGUŁA: „ostatnie słowo należy do właściciela".
        //
        // Gdy KUPUJĄCY (`!isListingOwner`) klika „Zgoda" na cenę właściciela,
        // NIE wysyłamy `ACCEPT` — bo backend skojarzy obustronną zgodę z
        // finalizacją (`AGREED + acceptedBidId → FINALIZED/SOLD`), zamykając
        // sprzedaż bez świadomego potwierdzenia właściciela.
        //
        // Zamiast tego wysyłamy `COUNTER` z tą samą kwotą, którą zaproponował
        // właściciel. To „technicznie kontroferta" o tej samej cenie, ale
        // semantycznie znaczy: „akceptuję — czekam na Twoje finalne potwierdzenie".
        // Właściciel zobaczy ją jako kontrofertę i będzie musiał świadomie
        // kliknąć ACCEPT (z withdraw promptem + ack-boxem). Dopiero wtedy
        // backend ustawi `AGREED + acceptedBidId`.
        //
        // Wyjątek: gdy to WŁAŚCICIEL (`isListingOwner`) klika ACCEPT — wtedy
        // zostaje pełne `ACCEPT`, bo to jego świadoma finalizacja.
        const isBuyerAcceptingOwnersPrice =
          decision === 'ACCEPT' && !effectiveIsListingOwner && Number(initialAmount || 0) > 0;

        payload.type = 'BID_RESPOND';
        payload.bidId = normalizedBidId;

        if (isBuyerAcceptingOwnersPrice) {
          payload.decision = 'COUNTER';
          payload.counterAmount = Number(initialAmount);
          const userNote = String(note || '').trim();
          payload.message =
            userNote ||
            t('dealroom.bid.buyerAcceptNote');
          payload.note = payload.message;
        } else {
          payload.decision = decision === 'REJECT' ? 'REJECT' : decision;
          payload.message = note;
          payload.note = note;
          if (decision === 'COUNTER') {
            payload.counterAmount = Number(amount.replace(/\D/g, ''));
          }
        }
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${safeToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || t('dealroom.bid.errors.saveFailed'));
        return;
      }

      // Finalizacja deala: backend po BID_RESPOND/ACCEPT od właściciela ustawia
      // `AGREED + acceptedBidId`, ale STATUS OFERTY (`ACTIVE` → `ARCHIVED`) nie
      // przełącza się automatycznie. Bez tego oferta zostaje w aktywnych i nie
      // ląduje w „Zakończone". Dlatego — analogicznie do rezerwacji po
      // prezentacji (`setOfferStatusPending`) — robimy to jawnie z klienta:
      // best-effort, błąd nie cofa już potwierdzonej akceptacji.
      const isOwnerFinalAccept =
        finalizeOwnerAccept &&
        mode === 'respond' &&
        decision === 'ACCEPT' &&
        effectiveIsListingOwner;

      if (isOwnerFinalAccept) {
        const acceptedAmount =
          Number(initialAmount || 0) > 0
            ? Number(initialAmount)
            : Number(String(amount || '').replace(/\D/g, ''));
        try {
          await postDealroomTextMessage({
            dealId: Number(dealId),
            token: safeToken,
            content: t('dealroom.bid.ownerAcceptChat', { amount: formatCurrency(acceptedAmount) }),
          });
        } catch {
          // wpis w czacie to UX/audit — pomijamy przy błędzie
        }

        const numericOfferId = Number(offerId || 0);
        if (Number.isFinite(numericOfferId) && numericOfferId > 0) {
          await archiveOfferAfterSaleClosed(API_URL, safeToken, numericOfferId);
        }
      }

      onDone?.();
      onClose();
    } catch (_e) {
      setError(t('dealroom.bid.errors.network'));
    } finally {
      setLoading(false);
    }
  };

  const finishReserveChoice = async () => {
    setWithdrawPromptVisible(false);
    await submitInner(true);
  };

  const getConfirmMessage = () => {
    if (mode === 'create') {
      return t('dealroom.bid.confirm.propose', { amount: formatCurrency(Number(amount || 0)) });
    }
    if (decision === 'ACCEPT') {
      if (effectiveIsListingOwner) {
        return t('dealroom.bid.confirm.ownerFinal');
      }
      return t('dealroom.bid.confirm.buyerHandoff', { amount: formatCurrency(Number(initialAmount || 0)) });
    }
    if (decision === 'REJECT') {
      return t('dealroom.bid.confirm.reject');
    }
    return t('dealroom.bid.confirm.counter', { amount: formatCurrency(Number(amount || 0)) });
  };

  const handleSubmitPress = () => {
    if (!canSubmit || loading || isLocked) return;
    setConfirmVisible(true);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 16 : 0}
          style={styles.keyboardWrap}
        >
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>DEALROOM</Text>
                <Text style={styles.title}>{title || t('dealroom.bid.defaultTitle')}</Text>
                <Text style={styles.intro}>{t('dealroom.bid.intro')}</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose} disabled={loading} hitSlop={8}>
                <X size={16} color="#d1d5db" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.content}
              contentContainerStyle={styles.contentInner}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bounces={false}
              alwaysBounceVertical={false}
              overScrollMode="never"
            >
            {isLocked && (
              <View style={styles.lockedBox}>
                <Text style={styles.lockIcon}>🔒</Text>
                <Text style={styles.lockTitle}>{t('dealroom.bid.lockedTitle')}</Text>
                <View style={styles.stamp}>
                  <Text style={styles.stampText}>{t('dealroom.bid.dealSealed')}</Text>
                </View>
              </View>
            )}

            {isWaitingForOther && !isLocked && (
              <View style={styles.waitingBox}>
                <Text style={styles.waitingIcon}>⏳</Text>
                <Text style={styles.waitingTitle}>{t('dealroom.bid.waitingTitle')}</Text>
                <Text style={styles.waitingSub}>{t('dealroom.bid.waitingSub')}</Text>
                {history.length > 0 && Number(history[history.length - 1]?.amount || 0) > 0 ? (
                  <View style={styles.waitingChip}>
                    <Text style={styles.waitingChipLabel}>{t('dealroom.bid.lastOfferLabel')}</Text>
                    <Text style={styles.waitingChipValue}>
                      {formatCurrency(history[history.length - 1]?.amount)}
                    </Text>
                  </View>
                ) : null}
              </View>
            )}

            {/* Banner informacyjny — kupujący akceptuje cenę właściciela.
                Wyjaśniamy, że transakcja NIE jest jeszcze sfinalizowana —
                ostatnie słowo ma właściciel. To zapobiega cichemu zamknięciu
                sprzedaży bez świadomej zgody właściciela. */}
            {decision === 'ACCEPT' &&
              !effectiveIsListingOwner &&
              !isLocked &&
              !isWaitingForOther &&
              mode === 'respond' &&
              Number(initialAmount || 0) > 0 && (
                <View style={styles.handoffBox}>
                  <Text style={styles.handoffIcon}>🤝</Text>
                  <Text style={styles.handoffTitle}>{t('dealroom.bid.handoffTitle', { amount: formatCurrency(initialAmount) })}</Text>
                  <Text style={styles.handoffSub}>{t('dealroom.bid.handoffSub')}</Text>
                </View>
              )}

            {history.length > 0 && (
              <View style={styles.timelineWrap}>
                <Text style={styles.timelineTitle}>{t('dealroom.bid.timelineTitle')}</Text>
                {history.map((item, idx) => {
                  const label =
                    item.action === 'ACCEPTED'
                      ? t('dealroom.bid.timeline.accepted')
                      : item.action === 'REJECTED'
                        ? t('dealroom.bid.timeline.rejected')
                        : item.action === 'COUNTERED'
                          ? t('dealroom.bid.timeline.countered')
                          : t('dealroom.bid.timeline.proposed');
                  return (
                    <View key={`${item.action || 'x'}-${idx}`} style={styles.timelineItem}>
                      <Text style={styles.timelineLabel}>{label}</Text>
                      <Text style={styles.timelineValue}>{formatCurrency(item.amount)}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {(mode === 'create' || decision === 'COUNTER') && !isWaitingForOther && (
              <View style={styles.sectionCard}>
                <View style={styles.stepHead}>
                  <View style={styles.stepNum}>
                    <Text style={styles.stepNumTxt}>1</Text>
                  </View>
                  <View style={styles.stepCopy}>
                    <Text style={styles.sectionLabel}>{t('dealroom.bid.yourProposal')}</Text>
                    <Text style={styles.stepHint}>
                      {t('dealroom.bid.amountHint', { step: Math.abs(QUICK_BID_STEPS[1]).toLocaleString('pl-PL') })}
                    </Text>
                  </View>
                </View>
                <View style={styles.amountHero}>
                  <TouchableOpacity
                    style={[styles.nudgeBtn, (isLocked || loading) && styles.nudgeBtnDisabled]}
                    onPress={() => adjustAmount(QUICK_BID_STEPS[0])}
                    disabled={isLocked || loading}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={t('dealroom.bid.decreaseA11y', {
                      amount: Math.abs(QUICK_BID_STEPS[0]).toLocaleString('pl-PL'),
                    })}
                  >
                    <Minus size={18} color={isLocked || loading ? '#5a5a5f' : '#f5f5f7'} strokeWidth={2.6} />
                  </TouchableOpacity>
                  <View style={styles.amountField}>
                    <TextInput
                      value={formatAmountInput(amount)}
                      onChangeText={(v) => setAmount(v.replace(/\D/g, ''))}
                      keyboardType="numeric"
                      placeholder={t('dealroom.bid.amountPlaceholder')}
                      placeholderTextColor="#6b6b70"
                      style={styles.amountInput}
                      editable={!isLocked && !loading}
                    />
                    <Text style={styles.amountSuffix}>zł</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.nudgeBtn, (isLocked || loading) && styles.nudgeBtnDisabled]}
                    onPress={() => adjustAmount(QUICK_BID_STEPS[1])}
                    disabled={isLocked || loading}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={t('dealroom.bid.increaseA11y', {
                      amount: Math.abs(QUICK_BID_STEPS[1]).toLocaleString('pl-PL'),
                    })}
                  >
                    <Plus size={18} color={isLocked || loading ? '#5a5a5f' : '#f5f5f7'} strokeWidth={2.6} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {mode === 'create' && !isWaitingForOther ? (
              <View style={styles.sectionCard}>
                <View style={styles.stepHead}>
                  <View style={styles.stepNum}>
                    <Text style={styles.stepNumTxt}>2</Text>
                  </View>
                  <View style={styles.stepCopy}>
                    <Text style={styles.sectionLabel}>{t('dealroom.bid.paymentLabel')}</Text>
                  </View>
                </View>
                <View style={styles.payTrack}>
                  <TouchableOpacity
                    style={[styles.paySeg, financing === 'CASH' && styles.paySegOn]}
                    onPress={() => setFinancing('CASH')}
                    activeOpacity={0.88}
                  >
                    <Banknote size={16} color={financing === 'CASH' ? '#0A0A0A' : '#d1d5db'} strokeWidth={2.1} />
                    <Text style={[styles.paySegTxt, financing === 'CASH' && styles.paySegTxtOn]}>
                      {t('dealroom.bid.financing.cash')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.paySeg, financing === 'CREDIT' && styles.paySegOn]}
                    onPress={() => setFinancing('CREDIT')}
                    activeOpacity={0.88}
                  >
                    <CreditCard size={16} color={financing === 'CREDIT' ? '#0A0A0A' : '#d1d5db'} strokeWidth={2.1} />
                    <Text style={[styles.paySegTxt, financing === 'CREDIT' && styles.paySegTxtOn]}>
                      {t('dealroom.bid.financing.credit')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            <View style={styles.sectionCard}>
              <View style={styles.stepHead}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumTxt}>{mode === 'create' ? '3' : '2'}</Text>
                </View>
                <View style={styles.stepCopy}>
                  <Text style={styles.sectionLabel}>{t('dealroom.bid.messageLabel')}</Text>
                </View>
              </View>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder={t('dealroom.bid.messagePlaceholder')}
                placeholderTextColor="#6b6b70"
                style={[styles.input, styles.note]}
                multiline
                editable={!isLocked && !loading}
              />
            </View>

            </ScrollView>

            {!!error && <Text style={styles.error}>{error}</Text>}

            <View style={styles.footerRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={onClose} disabled={loading}>
                <Text style={styles.secondaryTxt}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, !canSubmit && styles.disabled]} onPress={handleSubmitPress} disabled={!canSubmit || loading}>
                {loading ? <ActivityIndicator color="#0A0A0A" /> : <Text style={styles.primaryTxt}>{t('dealroom.bid.sendProposal')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>

        <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
          <View style={styles.confirmBackdrop}>
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>{t('dealroom.bid.confirmTitle')}</Text>
              <Text style={styles.confirmText}>{getConfirmMessage()}</Text>
              <View style={styles.confirmRow}>
                <TouchableOpacity style={styles.confirmSecondary} onPress={() => setConfirmVisible(false)}>
                  <Text style={styles.confirmSecondaryTxt}>{t('dealroom.bid.confirmNo')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmPrimary}
                  onPress={async () => {
                    setConfirmVisible(false);
                    if (
                      mode === 'respond' &&
                      decision === 'ACCEPT' &&
                      effectiveIsListingOwner &&
                      !isLocked
                    ) {
                      setWithdrawPromptVisible(true);
                      return;
                    }
                    await submitInner();
                  }}
                >
                  <Text style={styles.confirmPrimaryTxt}>{t('dealroom.bid.confirmYes')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={withdrawPromptVisible} transparent animationType="fade" onRequestClose={() => setWithdrawPromptVisible(false)}>
          <View style={styles.confirmBackdrop}>
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>{t('dealroom.bid.finalizeTitle')}</Text>
              <Text style={styles.confirmText}>{t('dealroom.bid.finalizeBody')}</Text>
              <View style={styles.consequenceList}>
                <Text style={styles.consequenceLine}>{t('dealroom.bid.finalizeConsequences.line1')}</Text>
                <Text style={styles.consequenceLine}>{t('dealroom.bid.finalizeConsequences.line2')}</Text>
                <Text style={styles.consequenceLine}>{t('dealroom.bid.finalizeConsequences.line3')}</Text>
              </View>
              <TouchableOpacity
                style={styles.ackRow}
                onPress={() => setOwnerFinalConsent((v) => !v)}
                activeOpacity={0.85}
              >
                <View style={[styles.ackBox, ownerFinalConsent && styles.ackBoxOn]}>
                  <Text style={styles.ackBoxTick}>{ownerFinalConsent ? '✓' : ''}</Text>
                </View>
                <Text style={styles.ackText}>{t('dealroom.bid.finalizeAck')}</Text>
              </TouchableOpacity>
              <View style={styles.confirmRow}>
                <TouchableOpacity
                  style={styles.confirmSecondary}
                  onPress={() => setWithdrawPromptVisible(false)}
                  disabled={loading}
                >
                  <Text style={styles.confirmSecondaryTxt}>{t('common.back')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmPrimary, (!ownerFinalConsent || loading) && styles.disabled]}
                  onPress={() => finishReserveChoice()}
                  disabled={!ownerFinalConsent || loading}
                >
                  <Text style={styles.confirmPrimaryTxt}>{t('dealroom.bid.finalizeConfirm')}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.stayPublicBtn, loading && styles.disabled]}
                onPress={() => setWithdrawPromptVisible(false)}
                disabled={loading}
              >
                <Text style={styles.stayPublicTxt}>{t('dealroom.bid.cancelFinalize')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', justifyContent: 'center', padding: 10 },
  keyboardWrap: { width: '100%', justifyContent: 'center' },
  card: { backgroundColor: '#0b0b0b', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, maxHeight: '96%' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  headerCopy: { flex: 1, minWidth: 0, paddingRight: 4 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  eyebrow: { color: '#8a8a8f', fontSize: 10, fontWeight: '800', letterSpacing: 1.3, textTransform: 'uppercase' },
  title: { color: '#fff', fontSize: 24, fontWeight: '700', letterSpacing: -0.3, marginTop: 4 },
  intro: { color: '#9da0a6', fontSize: 13, lineHeight: 18, fontWeight: '500', marginTop: 6 },
  content: { marginTop: 2 },
  contentInner: { paddingBottom: 8, flexGrow: 0 },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  stepNumTxt: { color: '#f5f5f7', fontSize: 11, fontWeight: '800' },
  stepCopy: { flex: 1, minWidth: 0 },
  sectionLabel: { color: '#e8e8ed', fontSize: 13, fontWeight: '800', letterSpacing: 0.1 },
  stepHint: { color: '#8e8e93', fontSize: 11, fontWeight: '500', marginTop: 2, lineHeight: 15 },
  sectionCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    padding: 12,
    marginBottom: 10,
  },
  amountHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nudgeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  nudgeBtnDisabled: { opacity: 0.4 },
  amountField: {
    flex: 1,
    minWidth: 0,
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(0,0,0,0.28)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 6,
  },
  amountInput: {
    flex: 1,
    minWidth: 0,
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
    paddingVertical: 8,
    fontVariant: ['tabular-nums'],
  },
  amountSuffix: {
    color: '#aeaeb2',
    fontSize: 15,
    fontWeight: '700',
  },
  payTrack: {
    flexDirection: 'row',
    gap: 4,
    padding: 3,
    borderRadius: 14,
    backgroundColor: 'rgba(118,118,128,0.22)',
  },
  paySeg: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 11,
  },
  paySegOn: {
    backgroundColor: '#F5F5F7',
  },
  paySegTxt: { color: '#d1d5db', fontWeight: '700', fontSize: 13 },
  paySegTxtOn: { color: '#0A0A0A' },
  input: { backgroundColor: 'rgba(0,0,0,0.28)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', color: '#fff', paddingHorizontal: 12, paddingVertical: 11, marginBottom: 0 },
  note: { minHeight: 76, textAlignVertical: 'top' },
  lockedBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.45)',
    backgroundColor: 'rgba(16,185,129,0.08)',
    padding: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  waitingBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,159,10,0.55)',
    backgroundColor: 'rgba(255,159,10,0.10)',
    padding: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  handoffBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(10,132,255,0.5)',
    backgroundColor: 'rgba(10,132,255,0.10)',
    padding: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  handoffIcon: { fontSize: 24, marginBottom: 6 },
  handoffTitle: {
    color: '#9FCBFF',
    fontWeight: '800',
    fontSize: 15,
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  handoffSub: {
    color: '#CCE2FF',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 6,
  },
  handoffStrong: { color: '#9FCBFF', fontWeight: '800' },
  waitingIcon: { fontSize: 26, marginBottom: 6 },
  waitingTitle: {
    color: '#FFD79A',
    fontWeight: '800',
    fontSize: 15,
    textAlign: 'center',
  },
  waitingSub: {
    color: '#E8C390',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 6,
  },
  waitingChip: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,159,10,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,159,10,0.4)',
    alignItems: 'center',
  },
  waitingChipLabel: {
    color: '#FFB44A',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  waitingChipValue: {
    color: '#FFEDD0',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 3,
    letterSpacing: 0.2,
  },
  lockIcon: { fontSize: 24, marginBottom: 6 },
  lockTitle: { color: '#e5ffe5', fontWeight: '800', fontSize: 15 },
  stamp: {
    marginTop: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(16,185,129,0.15)',
  },
  stampText: { color: '#10b981', fontWeight: '900', letterSpacing: 0.8, fontSize: 10 },
  timelineWrap: {
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: 10,
    backgroundColor: '#111113',
  },
  timelineTitle: { color: '#b8bbc1', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.8 },
  timelineItem: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
    backgroundColor: '#151518',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timelineLabel: { color: '#f3f4f6', fontWeight: '700', fontSize: 12 },
  timelineValue: { color: '#9ca3af', fontWeight: '700', fontSize: 12, marginLeft: 10 },
  footerRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  primaryBtn: { flex: 1.35, borderRadius: 14, backgroundColor: '#F5F5F7', alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  primaryTxt: { color: '#0A0A0A', fontWeight: '800', letterSpacing: 0.1, fontSize: 14 },
  secondaryBtn: { flex: 0.85, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, backgroundColor: 'rgba(255,255,255,0.05)' },
  secondaryTxt: { color: '#e1e1e4', fontWeight: '700', fontSize: 14 },
  error: { color: '#ff6b6b', marginBottom: 8, fontWeight: '600' },
  disabled: { opacity: 0.45 },
  confirmBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  confirmCard: { width: '100%', maxWidth: 380, borderRadius: 18, backgroundColor: '#101113', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 14 },
  confirmTitle: { color: '#fff', fontSize: 17, fontWeight: '800', marginBottom: 8 },
  confirmText: { color: '#d1d5db', fontSize: 13, lineHeight: 19, marginBottom: 14 },
  confirmRow: { flexDirection: 'row', gap: 8 },
  confirmSecondary: { flex: 1, borderRadius: 10, backgroundColor: '#1b1d20', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', paddingVertical: 10, alignItems: 'center' },
  confirmPrimary: { flex: 1, borderRadius: 10, backgroundColor: '#10b981', paddingVertical: 10, alignItems: 'center' },
  confirmSecondaryTxt: { color: '#d1d5db', fontSize: 12, fontWeight: '800' },
  confirmPrimaryTxt: { color: '#032014', fontSize: 12, fontWeight: '900' },
  consequenceList: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#16181b',
    marginBottom: 10,
    gap: 5,
  },
  consequenceLine: { color: '#d1d5db', fontSize: 12, lineHeight: 17, fontWeight: '600' },
  ackRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  ackBox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: '#16181b',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  ackBoxOn: { borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.2)' },
  ackBoxTick: { color: '#9af0bf', fontWeight: '900', fontSize: 13, lineHeight: 14 },
  ackText: { flex: 1, color: '#d1d5db', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  stayPublicBtn: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: '#1b1d20',
  },
  stayPublicTxt: { color: '#e5e7eb', fontSize: 12, fontWeight: '800' },
});

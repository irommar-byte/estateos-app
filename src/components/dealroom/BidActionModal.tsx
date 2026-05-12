import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { X, Minus, Plus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { API_URL } from '../../config/network';
import { archiveOwnOfferViaMobileAdmin } from '../../utils/mobileOfferArchive';
import { postDealroomTextMessage } from '../../utils/dealroomOfferReserve';

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
    const senderId = Number(last?.senderId ?? 0);
    return Number.isFinite(senderId) && senderId === myId;
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
            'Akceptuję Twoją cenę. Proszę o ostateczne potwierdzenie sprzedaży.';
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
        setError(data?.error || 'Nie udalo sie zapisac akcji.');
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
            content:
              `Decyzja właściciela: ostatecznie akceptuję cenę ${formatCurrency(acceptedAmount)} ` +
              `i zamykam sprzedaż. Oferta została wycofana z rynku.`,
          });
        } catch {
          // wpis w czacie to UX/audit — pomijamy przy błędzie
        }

        const numericOfferId = Number(offerId || 0);
        if (Number.isFinite(numericOfferId) && numericOfferId > 0) {
          try {
            const archived = await archiveOwnOfferViaMobileAdmin(
              API_URL,
              safeToken,
              numericOfferId
            );
            if (!archived) {
              setError(
                'Sprzedaż została zaakceptowana, ale nie udało się od razu wycofać oferty z rynku. Możesz to zrobić w „Moje oferty → Wycofaj".'
              );
            }
          } catch {
            setError(
              'Sprzedaż została zaakceptowana, ale nie udało się od razu wycofać oferty z rynku. Możesz to zrobić w „Moje oferty → Wycofaj".'
            );
          }
        }
      }

      onDone?.();
      onClose();
    } catch (_e) {
      setError('Blad polaczenia z serwerem.');
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
      return `Czy na pewno chcesz zaproponować cenę ${formatCurrency(Number(amount || 0))}?`;
    }
    if (decision === 'ACCEPT') {
      if (effectiveIsListingOwner) {
        return 'Czy na pewno chcesz finalnie zaakceptować tę cenę jako właściciel? Ta akcja kończy transakcję i wycofuje ofertę z rynku.';
      }
      // Kupujący akceptuje cenę właściciela — to NIE finalizuje deala.
      // Wysyłamy do właściciela do ostatecznego potwierdzenia.
      return (
        `Wysyłamy do właściciela: „Akceptuję cenę ${formatCurrency(Number(initialAmount || 0))}".\n\n` +
        'Transakcja NIE zostanie zamknięta od razu — właściciel musi ostatecznie potwierdzić sprzedaż. ' +
        'Dopiero wtedy oferta zostanie wycofana z rynku.'
      );
    }
    if (decision === 'REJECT') {
      return 'Czy na pewno chcesz odrzucić tę propozycję ceny?';
    }
    return `Czy na pewno chcesz wysłać kontrofertę ${formatCurrency(Number(amount || 0))}?`;
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
              <View />
              <TouchableOpacity style={styles.closeBtn} onPress={onClose} disabled={loading}>
                <X size={16} color="#d1d5db" />
              </TouchableOpacity>
            </View>
            <Text style={styles.eyebrow}>DEALROOM</Text>
            <Text style={styles.title}>{title || 'Negocjacja ceny'}</Text>

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
                <Text style={styles.lockTitle}>Cena zaakceptowana</Text>
                <View style={styles.stamp}>
                  <Text style={styles.stampText}>DEAL SEALED</Text>
                </View>
              </View>
            )}

            {isWaitingForOther && !isLocked && (
              <View style={styles.waitingBox}>
                <Text style={styles.waitingIcon}>⏳</Text>
                <Text style={styles.waitingTitle}>Czekasz na odpowiedź drugiej strony</Text>
                <Text style={styles.waitingSub}>
                  Twoja ostatnia kontroferta cenowa została wysłana — partner musi ją zaakceptować,
                  odrzucić lub zaproponować inną kwotę. Do tego czasu nie możesz wysłać kolejnej.
                </Text>
                {history.length > 0 && Number(history[history.length - 1]?.amount || 0) > 0 ? (
                  <View style={styles.waitingChip}>
                    <Text style={styles.waitingChipLabel}>TWOJA OSTATNIA OFERTA</Text>
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
                  <Text style={styles.handoffTitle}>Akceptujesz cenę {formatCurrency(initialAmount)}</Text>
                  <Text style={styles.handoffSub}>
                    Twoja akceptacja zostanie wysłana do właściciela.{'\n'}
                    Transakcja zostanie sfinalizowana dopiero, gdy{' '}
                    <Text style={styles.handoffStrong}>właściciel ostatecznie potwierdzi sprzedaż</Text>.
                  </Text>
                </View>
              )}

            {history.length > 0 && (
              <View style={styles.timelineWrap}>
                <Text style={styles.timelineTitle}>Historia negocjacji</Text>
                {history.map((item, idx) => {
                  const label =
                    item.action === 'ACCEPTED'
                      ? 'Zaakceptowano'
                      : item.action === 'REJECTED'
                        ? 'Odrzucono'
                        : item.action === 'COUNTERED'
                          ? 'Kontroferta'
                          : 'Propozycja';
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
                <Text style={styles.sectionLabel}>Twoja propozycja</Text>
                <TextInput
                  value={amount}
                  onChangeText={(v) => setAmount(v.replace(/[^\d]/g, ''))}
                  keyboardType="numeric"
                  placeholder="Kwota PLN"
                  placeholderTextColor="#777"
                  style={styles.input}
                  editable={!isLocked && !loading}
                />
                <View style={styles.stepperRow}>
                  {QUICK_BID_STEPS.map((delta) => {
                    const isPositive = delta > 0;
                    const label = `${isPositive ? '+' : '−'} ${Math.abs(delta).toLocaleString('pl-PL')}`;
                    const disabled = isLocked || loading;
                    return (
                      <TouchableOpacity
                        key={delta}
                        style={[styles.stepperBtn, disabled && styles.stepperBtnDisabled]}
                        onPress={() => adjustAmount(delta)}
                        disabled={disabled}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel={`${isPositive ? 'Zwieksz' : 'Zmniejsz'} kwote o ${Math.abs(delta).toLocaleString('pl-PL')} zlotych`}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        {isPositive ? (
                          <Plus size={14} color={disabled ? '#5a5a5f' : '#e1e1e4'} strokeWidth={2.6} />
                        ) : (
                          <Minus size={14} color={disabled ? '#5a5a5f' : '#e1e1e4'} strokeWidth={2.6} />
                        )}
                        <Text style={[styles.stepperTxt, disabled && styles.stepperTxtDisabled]} numberOfLines={1}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {mode === 'create' && (
                  <View style={styles.segment}>
                    <TouchableOpacity style={[styles.segmentBtn, financing === 'CASH' && styles.segmentBtnActive]} onPress={() => setFinancing('CASH')}>
                      <Text style={[styles.segmentTxt, financing === 'CASH' && styles.segmentTxtActive]}>Gotowka</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.segmentBtn, financing === 'CREDIT' && styles.segmentBtnActive]} onPress={() => setFinancing('CREDIT')}>
                      <Text style={[styles.segmentTxt, financing === 'CREDIT' && styles.segmentTxtActive]}>Kredyt</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            <View style={styles.sectionCard}>
              <Text style={styles.sectionLabel}>Wiadomosc</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Dodaj komentarz (opcjonalnie)"
                placeholderTextColor="#777"
                style={[styles.input, styles.note]}
                multiline
                editable={!isLocked && !loading}
              />
            </View>

            </ScrollView>

            {!!error && <Text style={styles.error}>{error}</Text>}

            <View style={styles.footerRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={onClose} disabled={loading}>
                <Text style={styles.secondaryTxt}>Anuluj</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryBtn, !canSubmit && styles.disabled]} onPress={handleSubmitPress} disabled={!canSubmit || loading}>
                {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryTxt}>Wyslij</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>

        <Modal visible={confirmVisible} transparent animationType="fade" onRequestClose={() => setConfirmVisible(false)}>
          <View style={styles.confirmBackdrop}>
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>Potwierdzenie</Text>
              <Text style={styles.confirmText}>{getConfirmMessage()}</Text>
              <View style={styles.confirmRow}>
                <TouchableOpacity style={styles.confirmSecondary} onPress={() => setConfirmVisible(false)}>
                  <Text style={styles.confirmSecondaryTxt}>Nie</Text>
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
                  <Text style={styles.confirmPrimaryTxt}>Tak, wyślij</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={withdrawPromptVisible} transparent animationType="fade" onRequestClose={() => setWithdrawPromptVisible(false)}>
          <View style={styles.confirmBackdrop}>
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>Finalizacja transakcji</Text>
              <Text style={styles.confirmText}>
                Jako właściciel finalnie akceptujesz sprzedaż tej nieruchomości za uzgodnioną cenę dla kupującego.
              </Text>
              <View style={styles.consequenceList}>
                <Text style={styles.consequenceLine}>• Sprzedaż zostanie zakończona.</Text>
                <Text style={styles.consequenceLine}>• Oferta trafi do archiwalnych / sfinalizowanych.</Text>
                <Text style={styles.consequenceLine}>• Przywrócenie oferty będzie wymagało kolejnych środków.</Text>
              </View>
              <TouchableOpacity
                style={styles.ackRow}
                onPress={() => setOwnerFinalConsent((v) => !v)}
                activeOpacity={0.85}
              >
                <View style={[styles.ackBox, ownerFinalConsent && styles.ackBoxOn]}>
                  <Text style={styles.ackBoxTick}>{ownerFinalConsent ? '✓' : ''}</Text>
                </View>
                <Text style={styles.ackText}>
                  Akceptuję sprzedaż za tę cenę oraz wycofanie oferty z rynku (status zakończona/sfinalizowana).
                  Rozumiem, że ewentualne przywrócenie oferty będzie wymagało kolejnych środków.
                </Text>
              </TouchableOpacity>
              <View style={styles.confirmRow}>
                <TouchableOpacity
                  style={styles.confirmSecondary}
                  onPress={() => setWithdrawPromptVisible(false)}
                  disabled={loading}
                >
                  <Text style={styles.confirmSecondaryTxt}>Wróć</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmPrimary, (!ownerFinalConsent || loading) && styles.disabled]}
                  onPress={() => finishReserveChoice()}
                  disabled={!ownerFinalConsent || loading}
                >
                  <Text style={styles.confirmPrimaryTxt}>Akceptuję i finalizuję</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.stayPublicBtn, loading && styles.disabled]}
                onPress={() => setWithdrawPromptVisible(false)}
                disabled={loading}
              >
                <Text style={styles.stayPublicTxt}>Anuluj finalizację</Text>
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
  headerRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 2 },
  closeBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', backgroundColor: '#141418' },
  eyebrow: { color: '#8a8a8f', fontSize: 10, fontWeight: '800', letterSpacing: 1.3, textTransform: 'uppercase' },
  title: { color: '#fff', fontSize: 24, fontWeight: '700', letterSpacing: -0.3, marginTop: 4, marginBottom: 6 },
  content: { marginTop: 2 },
  contentInner: { paddingBottom: 8, flexGrow: 0 },
  sectionLabel: { color: '#9da0a6', fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  sectionCard: {
    backgroundColor: '#111113',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 10,
    marginBottom: 10,
  },
  input: { backgroundColor: '#161618', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', color: '#fff', paddingHorizontal: 12, paddingVertical: 11, marginBottom: 0 },
  note: { minHeight: 84, textAlignVertical: 'top' },
  stepperRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  stepperBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#17171a',
    paddingVertical: 11,
    paddingHorizontal: 10,
  },
  stepperBtnDisabled: {
    opacity: 0.45,
  },
  stepperTxt: {
    color: '#e1e1e4',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.3,
    fontVariant: ['tabular-nums'],
  },
  stepperTxtDisabled: {
    color: '#5a5a5f',
  },
  segment: { flexDirection: 'row', gap: 8 },
  segmentBtn: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', paddingVertical: 10, alignItems: 'center', backgroundColor: '#17171a' },
  segmentBtnActive: { borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.16)' },
  acceptBtn: { borderColor: 'rgba(16,185,129,0.45)', backgroundColor: 'rgba(16,185,129,0.15)' },
  segmentTxt: { color: '#c0c3c8', fontWeight: '700', fontSize: 12 },
  acceptTxt: { color: '#9af0bf' },
  segmentTxtActive: { color: '#10b981' },
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
  footerRow: { flexDirection: 'row', gap: 10, marginTop: 2 },
  primaryBtn: { flex: 1, borderRadius: 12, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center', paddingVertical: 13 },
  primaryTxt: { color: '#04120d', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, fontSize: 12 },
  secondaryBtn: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', paddingVertical: 13, backgroundColor: '#131316' },
  secondaryTxt: { color: '#e1e1e4', fontWeight: '700', fontSize: 12 },
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

import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { X } from 'lucide-react-native';
import { postDealroomTextMessage, setOfferStatusPending } from '../../utils/dealroomOfferReserve';
import { API_URL } from '../../config/network';

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
  }>;
  onClose: () => void;
  onDone?: () => void;
  /** Właściciel listingu — przy akceptacji ceny pytamy o wycofanie z publikacji (rezerwacja). */
  offerId?: number | null;
  userId?: number | null;
  isListingOwner?: boolean;
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
  onClose,
  onDone,
  offerId = null,
  userId = null,
  isListingOwner = false,
}: BidActionModalProps) {
  const [amount, setAmount] = useState(initialAmount ? String(Math.round(initialAmount)) : '');
  const [note, setNote] = useState('');
  const [financing, setFinancing] = useState<'CASH' | 'CREDIT'>('CASH');
  const [decision, setDecision] = useState<BidDecision>('COUNTER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [withdrawPromptVisible, setWithdrawPromptVisible] = useState(false);

  const isLocked = useMemo(
    () => mode === 'respond' && String(eventAction || '').toUpperCase() === 'ACCEPTED',
    [mode, eventAction]
  );

  useEffect(() => {
    if (!visible) return;
    setAmount(initialAmount ? String(Math.round(initialAmount)) : '');
    setNote('');
    setFinancing('CASH');
    setDecision(quickAccept ? 'ACCEPT' : 'COUNTER');
    setError(null);
    setWithdrawPromptVisible(false);
    setConfirmVisible(false);
  }, [visible, initialAmount, quickAccept]);

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
      if (decision !== 'COUNTER') return true;
    }
    return amount.trim().length > 0;
  }, [dealId, token, mode, normalizedBidId, decision, amount, isLocked]);

  const submitInner = async (reserveChoice?: { withdrawFromPublicSale: boolean }) => {
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
      } else {
        payload.type = 'BID_RESPOND';
        payload.bidId = normalizedBidId;
        payload.decision = decision === 'REJECT' ? 'REJECT' : decision;
        payload.message = note;
        if (decision === 'COUNTER') {
          payload.counterAmount = Number(amount.replace(/\D/g, ''));
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

      if (
        mode === 'respond' &&
        decision === 'ACCEPT' &&
        isListingOwner &&
        dealId &&
        reserveChoice !== undefined
      ) {
        const withdraw = reserveChoice.withdrawFromPublicSale;
        const msg = withdraw
          ? 'Decyzja właściciela: oferta została wycofana z publikacji (rezerwacja uzgodnionej ceny).'
          : 'Decyzja właściciela: oferta pozostaje widoczna na rynku po uzgodnieniu ceny rezerwacyjnej.';
        await postDealroomTextMessage({ dealId, token: safeToken, content: msg });
        if (withdraw && offerId != null && userId != null) {
          const pendingRes = await setOfferStatusPending({
            offerId: Number(offerId),
            userId: Number(userId),
            token: safeToken,
          });
          if (!pendingRes.ok) {
            console.warn('[BidActionModal] setOfferStatusPending', pendingRes.error);
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

  const finishReserveChoice = async (withdrawFromPublicSale: boolean) => {
    setWithdrawPromptVisible(false);
    await submitInner({ withdrawFromPublicSale });
  };

  const getConfirmMessage = () => {
    if (mode === 'create') {
      return `Czy na pewno chcesz zaproponować cenę ${formatCurrency(Number(amount || 0))}?`;
    }
    if (decision === 'ACCEPT') {
      return 'Czy na pewno chcesz zaakceptować tę cenę?';
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

            {mode === 'respond' && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionLabel}>Decyzja</Text>
                <View style={styles.segment}>
                  <TouchableOpacity
                    style={[styles.segmentBtn, styles.acceptBtn, decision === 'ACCEPT' && styles.segmentBtnActive, loading && styles.disabled]}
                    onPress={() => setDecision('ACCEPT')}
                    disabled={loading || isLocked}
                  >
                    <Text style={[styles.segmentTxt, styles.acceptTxt]}>Akceptuj cenę</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.segmentBtn, decision === 'COUNTER' && styles.segmentBtnActive, loading && styles.disabled]}
                    onPress={() => setDecision('COUNTER')}
                    disabled={loading || isLocked}
                  >
                    <Text style={[styles.segmentTxt, decision === 'COUNTER' && styles.segmentTxtActive]}>Zaproponuj swoją cenę</Text>
                  </TouchableOpacity>
                </View>
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

            {(mode === 'create' || decision === 'COUNTER') && (
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
                      isListingOwner &&
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
              <Text style={styles.confirmTitle}>Rezerwacja ceny</Text>
              <Text style={styles.confirmText}>
                Czy chcesz wycofać ofertę z publikacji (sprzedaż „zarezerwowana” dla tej negocjacji), czy zostawić ją widoczną na rynku?
              </Text>
              <View style={styles.confirmRow}>
                <TouchableOpacity
                  style={styles.confirmSecondary}
                  onPress={() => setWithdrawPromptVisible(false)}
                  disabled={loading}
                >
                  <Text style={styles.confirmSecondaryTxt}>Wróć</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmPrimary}
                  onPress={() => finishReserveChoice(true)}
                  disabled={loading}
                >
                  <Text style={styles.confirmPrimaryTxt}>Wycofaj</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.stayPublicBtn, loading && styles.disabled]}
                onPress={() => finishReserveChoice(false)}
                disabled={loading}
              >
                <Text style={styles.stayPublicTxt}>Zostaw widoczną</Text>
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

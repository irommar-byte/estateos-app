/**
 * ====================================================================
 *  EstateOS™ — Modal „Ostateczna decyzja sprzedaży" (widok WŁAŚCICIELA)
 * ====================================================================
 *
 *  Otwiera się W MIEJSCU `BidActionModal` w momencie, gdy:
 *    1. kupujący wysłał kontrofertę z notą „Akceptuję Twoją cenę.
 *       Proszę o ostateczne potwierdzenie sprzedaży." (czyli stan
 *       wytwarzany przez kliknięcie „Zgoda" na cenie właściciela
 *       w `BidActionModal` → `isBuyerAcceptingOwnersPrice`),
 *    2. zalogowany użytkownik to WŁAŚCICIEL listingu (sprzedawca).
 *
 *  Klasyczny modal negocjacji jest tu przesadnie skomplikowany — pyta
 *  o kwotę, kontrofertę, financing, notatkę. W tym konkretnym kroku
 *  jedyna decyzja właściciela to:  POTWIERDZAM  /  NIE POTWIERDZAM.
 *
 *  UX świadomie „podniosły":
 *    • duża, bezdyskusyjna kwota na środku,
 *    • subtelny animowany blask, jak pieczęć na dokumencie,
 *    • potwierdzenie zamyka transakcję, więc dorzucamy ack-box („Jestem
 *      świadomy, że to finalizuje sprzedaż i wycofuje ofertę z rynku").
 *
 *  Endpoint: ten sam `POST /api/mobile/v1/deals/{dealId}/actions`,
 *  z payloadem identycznym jak w `BidActionModal` dla ACCEPT od właściciela:
 *      { type: 'BID_RESPOND', bidId, decision: 'ACCEPT', message, note }
 *
 *  Po sukcesie:
 *    • najpierw publikujemy do czatu wiadomość „Decyzja właściciela: …"
 *      (identycznie jak BidActionModal),
 *    • potem archiwizujemy ofertę (`archiveOwnOfferViaMobileAdmin`),
 *    • na końcu wywołujemy `onDone()` żeby rodzic mógł odświeżyć
 *      `fetchMessages` + `fetchDealSnapshot`.
 *
 *  Wszystkie te side-effecty są celowo skopiowane z `BidActionModal`,
 *  żeby zachowanie po zatwierdzeniu było 1:1 z istniejącym przepływem
 *  i backendem (żadnego rozjazdu „ten modal zrobił coś inaczej").
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { API_URL } from '../../config/network';
import { archiveOwnOfferViaMobileAdmin } from '../../utils/mobileOfferArchive';
import { postDealroomTextMessage } from '../../utils/dealroomOfferReserve';

type Props = {
  visible: boolean;
  /** ID deala, do którego wysyłamy `BID_RESPOND` (ACCEPT / REJECT). */
  dealId: number | null;
  /** ID konkretnego bidu, który kupujący wystawił jako „finalną akceptację". */
  bidId: number | null;
  /**
   * Kwota końcowa — tak właśnie pokazujemy ją na środku ekranu. Backend
   * dostanie ją w polu `counterAmount` przy ACCEPT z naszej strony? NIE —
   * backend i tak wie z kontekstu `bidId`. Tu używamy tylko do UI.
   */
  amount: number;
  /**
   * Token JWT — przekazujemy 1:1 z `DealroomChatScreen.tsx` (`token` z
   * `useAuthStore`). Sam modal go nie pobiera, żeby był pure UI.
   */
  token: string | null;
  /**
   * ID oferty — potrzebne, żeby po akceptacji wywołać archiwizację
   * (oferta znika z rynku, status → archived/finalizowana).
   */
  offerId: number | null;
  /** Imię kupującego (do tekstu „Twoja decyzja kończy transakcję z {imię}"). */
  buyerLabel?: string | null;

  onClose: () => void;
  onDone?: () => void;
};

function formatPLN(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '— PLN';
  return `${Math.round(value).toLocaleString('pl-PL')} PLN`;
}

function normalizeToken(rawToken: string | null) {
  if (!rawToken) return null;
  const trimmed = rawToken.trim();
  if (!trimmed) return null;
  return trimmed.startsWith('Bearer ') ? trimmed.slice('Bearer '.length).trim() : trimmed;
}

export default function FinalConfirmationModal({
  visible,
  dealId,
  bidId,
  amount,
  token,
  offerId,
  buyerLabel,
  onClose,
  onDone,
}: Props) {
  const [stage, setStage] = useState<'idle' | 'confirming' | 'rejecting'>('idle');
  const [ackConfirmed, setAckConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const haloPulse = useRef(new Animated.Value(0)).current;

  // Pulsująca animacja blasku „pieczęci" — tylko gdy modal otwarty, żeby
  // nie zjadać kosztu animacji w tle.
  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(haloPulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(haloPulse, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [haloPulse, visible]);

  // Reset stanów przy każdym otwarciu — żeby nie zostawały stare flagi.
  useEffect(() => {
    if (visible) {
      setStage('idle');
      setAckConfirmed(false);
      setError(null);
      setLoading(false);
    }
  }, [visible]);

  const haloOpacity = haloPulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.9] });
  const haloScale = haloPulse.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1.04] });

  const canConfirm = stage === 'confirming' && ackConfirmed && !loading;
  const canReject = stage === 'rejecting' && !loading;

  const buyerNameLabel = useMemo(() => {
    const s = String(buyerLabel || '').trim();
    return s.length > 0 ? s : 'kupującego';
  }, [buyerLabel]);

  const sendDecision = async (decision: 'ACCEPT' | 'REJECT') => {
    const safeToken = normalizeToken(token);
    if (!dealId || !bidId || !safeToken) {
      setError('Brak danych do potwierdzenia (deal/bid/token).');
      return;
    }
    setLoading(true);
    setError(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const endpoint = `${API_URL}/api/mobile/v1/deals/${dealId}/actions`;
      const payload: any = {
        type: 'BID_RESPOND',
        bidId: Number(bidId),
        decision,
        message: decision === 'ACCEPT'
          ? `Decyzja właściciela: ostatecznie akceptuję cenę ${formatPLN(amount)} i zamykam sprzedaż.`
          : 'Decyzja właściciela: nie potwierdzam tej ceny. Otwieram dalsze negocjacje.',
      };
      payload.note = payload.message;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${safeToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Nie udało się zapisać decyzji.');
        setLoading(false);
        return;
      }

      // Akceptacja właściciela = finalizacja deala. Robimy DOKŁADNIE to,
      // co robi `BidActionModal` po `isOwnerFinalAccept`:
      //  1. publikujemy wiadomość audytową w czacie,
      //  2. archiwizujemy własną ofertę (znika z rynku).
      if (decision === 'ACCEPT') {
        try {
          await postDealroomTextMessage({
            dealId: Number(dealId),
            token: safeToken,
            content:
              `Decyzja właściciela: ostatecznie akceptuję cenę ${formatPLN(amount)} ` +
              `i zamykam sprzedaż. Oferta została wycofana z rynku.`,
          });
        } catch {
          // wpis w czacie to UX/audit — pomijamy przy błędzie
        }
        const numericOfferId = Number(offerId || 0);
        if (Number.isFinite(numericOfferId) && numericOfferId > 0) {
          try {
            const archived = await archiveOwnOfferViaMobileAdmin(API_URL, safeToken, numericOfferId);
            if (!archived) {
              setError(
                'Sprzedaż została zaakceptowana, ale nie udało się od razu wycofać oferty z rynku. Możesz to zrobić w „Moje oferty → Wycofaj".',
              );
            }
          } catch {
            setError(
              'Sprzedaż została zaakceptowana, ale nie udało się od razu wycofać oferty z rynku. Możesz to zrobić w „Moje oferty → Wycofaj".',
            );
          }
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }

      onDone?.();
      onClose();
    } catch (_e) {
      setError('Błąd połączenia z serwerem.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Górny pasek z X-em (bez tytułu — eyebrow niżej robi rolę nagłówka). */}
          <View style={styles.topRow}>
            <Text style={styles.eyebrow}>OSTATECZNA DECYZJA SPRZEDAŻY</Text>
            <Pressable onPress={onClose} hitSlop={10} disabled={loading} style={styles.closeBtn}>
              <Text style={styles.closeTxt}>×</Text>
            </Pressable>
          </View>

          {/* Pieczęć z kwotą. Halo pulsuje delikatnie pod tłem. */}
          <View style={styles.priceWrap}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.priceHalo,
                { opacity: haloOpacity, transform: [{ scale: haloScale }] },
              ]}
            />
            <Text style={styles.priceLabel}>Cena uzgodniona z {buyerNameLabel}</Text>
            <Text style={styles.priceValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              {formatPLN(amount)}
            </Text>
            <View style={styles.priceUnderline} />
            <Text style={styles.priceSub}>
              Kupujący zaakceptował tę cenę i czeka na Twoje ostateczne potwierdzenie.
            </Text>
          </View>

          {/* Tekst pytania — krótki, „magiczny", jednoznaczny. */}
          <Text style={styles.question}>Czy potwierdzasz tę cenę jako ostateczną?</Text>

          {/* Stan IDLE: dwa wielkie przyciski. */}
          {stage === 'idle' ? (
            <View style={styles.actionsRow}>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setStage('rejecting');
                }}
                style={({ pressed }) => [styles.rejectBtn, pressed && { opacity: 0.85 }]}
                disabled={loading}
              >
                <Text style={styles.rejectTxt}>NIE POTWIERDZAM</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setStage('confirming');
                }}
                style={({ pressed }) => [styles.confirmBtn, pressed && { opacity: 0.85 }]}
                disabled={loading}
              >
                <Text style={styles.confirmTxt}>POTWIERDZAM</Text>
              </Pressable>
            </View>
          ) : null}

          {/* Stan CONFIRMING: pokazujemy ack-box i finalny CTA „Zamknij sprzedaż". */}
          {stage === 'confirming' ? (
            <View>
              <View style={styles.consequenceBox}>
                <Text style={styles.consequenceTitle}>Co się stanie, gdy potwierdzisz:</Text>
                <Text style={styles.consequenceLine}>• Sprzedaż zostanie ostatecznie zakończona.</Text>
                <Text style={styles.consequenceLine}>• Oferta zostanie wycofana z rynku i przeniesiona do „Sfinalizowane”.</Text>
                <Text style={styles.consequenceLine}>• Ponowne wystawienie wymagać będzie nowej publikacji.</Text>
              </View>

              <Pressable
                onPress={() => setAckConfirmed((v) => !v)}
                style={({ pressed }) => [styles.ackRow, pressed && { opacity: 0.85 }]}
              >
                <View style={[styles.ackBox, ackConfirmed && styles.ackBoxOn]}>
                  <Text style={styles.ackTick}>{ackConfirmed ? '✓' : ''}</Text>
                </View>
                <Text style={styles.ackTxt}>
                  Jestem świadomy/-a, że potwierdzenie kończy transakcję i wycofuje ofertę z rynku.
                </Text>
              </Pressable>

              {!!error && <Text style={styles.error}>{error}</Text>}

              <View style={styles.actionsRow}>
                <Pressable
                  onPress={() => setStage('idle')}
                  disabled={loading}
                  style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.85 }]}
                >
                  <Text style={styles.backTxt}>Wróć</Text>
                </Pressable>
                <Pressable
                  onPress={() => sendDecision('ACCEPT')}
                  disabled={!canConfirm}
                  style={({ pressed }) => [
                    styles.finalConfirmBtn,
                    (!canConfirm || pressed) && { opacity: !canConfirm ? 0.5 : 0.85 },
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator color="#04120d" />
                  ) : (
                    <Text style={styles.finalConfirmTxt}>ZAMYKAM SPRZEDAŻ</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : null}

          {/* Stan REJECTING: krótki disclaimer i CTA „Wracam do negocjacji". */}
          {stage === 'rejecting' ? (
            <View>
              <View style={styles.rejectInfoBox}>
                <Text style={styles.rejectInfoTitle}>Negocjacje pozostają otwarte</Text>
                <Text style={styles.rejectInfoBody}>
                  Wysyłamy do {buyerNameLabel} informację, że ta cena nie jest dla Ciebie ostateczna.
                  Możecie kontynuować rozmowę o kwocie, terminie lub warunkach.
                </Text>
              </View>

              {!!error && <Text style={styles.error}>{error}</Text>}

              <View style={styles.actionsRow}>
                <Pressable
                  onPress={() => setStage('idle')}
                  disabled={loading}
                  style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.85 }]}
                >
                  <Text style={styles.backTxt}>Wróć</Text>
                </Pressable>
                <Pressable
                  onPress={() => sendDecision('REJECT')}
                  disabled={!canReject}
                  style={({ pressed }) => [
                    styles.finalRejectBtn,
                    (!canReject || pressed) && { opacity: !canReject ? 0.5 : 0.85 },
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.finalRejectTxt}>WRACAM DO NEGOCJACJI</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const GOLD = '#F5C56A';
const NEON = '#10b981';
const DANGER = '#ef4444';

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: '#0a0a0a',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(245,197,106,0.35)',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 18,
    shadowColor: GOLD,
    shadowOpacity: 0.25,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: {
    color: GOLD,
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  closeTxt: { color: '#d1d5db', fontSize: 22, fontWeight: '900', lineHeight: 22, marginTop: -2 },

  priceWrap: {
    marginTop: 18,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceHalo: {
    position: 'absolute',
    width: '85%',
    height: '120%',
    borderRadius: 200,
    backgroundColor: GOLD,
    shadowColor: GOLD,
    shadowOpacity: 1,
    shadowRadius: 50,
    shadowOffset: { width: 0, height: 0 },
  },
  priceLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  priceValue: {
    color: '#FFFFFF',
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  priceUnderline: {
    width: 64,
    height: 2,
    borderRadius: 2,
    backgroundColor: GOLD,
    marginTop: 10,
    marginBottom: 12,
  },
  priceSub: {
    color: '#cbd5e1',
    fontSize: 12.5,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 18,
    lineHeight: 17,
  },

  question: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 14,
    marginBottom: 18,
    letterSpacing: -0.2,
  },

  actionsRow: { flexDirection: 'row', gap: 10 },
  rejectBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#161616',
    borderWidth: 1.4,
    borderColor: 'rgba(239,68,68,0.45)',
    alignItems: 'center',
  },
  rejectTxt: { color: DANGER, fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  confirmBtn: {
    flex: 1.3,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: NEON,
    alignItems: 'center',
    shadowColor: NEON,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  confirmTxt: { color: '#04120d', fontSize: 13, fontWeight: '900', letterSpacing: 1.4 },

  consequenceBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#16181b',
    padding: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  consequenceTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  consequenceLine: { color: '#cbd5e1', fontSize: 12, fontWeight: '600', lineHeight: 17 },

  ackRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 14,
  },
  ackBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.4,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: '#161618',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  ackBoxOn: { borderColor: NEON, backgroundColor: 'rgba(16,185,129,0.2)' },
  ackTick: { color: '#9af0bf', fontSize: 13, fontWeight: '900' },
  ackTxt: { flex: 1, color: '#e2e8f0', fontSize: 12.5, fontWeight: '600', lineHeight: 17 },

  rejectInfoBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
    backgroundColor: 'rgba(239,68,68,0.08)',
    padding: 12,
    marginBottom: 14,
  },
  rejectInfoTitle: { color: '#FFB4B4', fontSize: 13, fontWeight: '900', marginBottom: 4 },
  rejectInfoBody: { color: '#F2C4C4', fontSize: 12, fontWeight: '500', lineHeight: 17 },

  backBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#1b1d20',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
  },
  backTxt: { color: '#d1d5db', fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },

  finalConfirmBtn: {
    flex: 1.4,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: NEON,
    alignItems: 'center',
    shadowColor: NEON,
    shadowOpacity: 0.55,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
  },
  finalConfirmTxt: { color: '#04120d', fontSize: 13, fontWeight: '900', letterSpacing: 1.4 },
  finalRejectBtn: {
    flex: 1.4,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: DANGER,
    alignItems: 'center',
  },
  finalRejectTxt: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', letterSpacing: 1.4 },

  error: { color: '#ff6b6b', fontSize: 12, fontWeight: '700', marginBottom: 10 },
});

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import LiveEventCountdown from '../openHouse/LiveEventCountdown';
import { fetchOpenHouseEvent } from '../../services/openHouseService';
import { fetchAuctionEvent } from '../../services/auctionService';
import type { OpenHouseEventRecord } from '../../contracts/openHouseContract';
import type { AuctionEventRecord } from '../../contracts/auctionContract';
import { parseSellerEventProposal } from '../../lib/sellerEventStage';

type EventSummary = {
  id: number;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  title?: string | null;
  startPrice?: number;
};

type Proposal = {
  id: number;
  title: string;
  status: string;
  payload?: Record<string, unknown> | null;
} | null;

type Props = {
  token: string;
  openHouse: { proposal: Proposal; event: EventSummary | null };
  auction: { proposal: Proposal; event: EventSummary | null };
  stage: { id: string; label: string; kind: 'open_house' | 'auction' | null } | null;
  colors: {
    card: string;
    border: string;
    text: string;
    secondary: string;
    accent: string;
    input: string;
  };
  /** Called when user should focus the launch form for a kind that is free. */
  onRequestLaunch?: (kind: 'open_house' | 'auction') => void;
};

type Tone = {
  label: string;
  color: string;
  bg: string;
};

function stageTone(
  kind: 'open_house' | 'auction',
  status: string,
  startsAt: string | null,
  endsAt: string | null,
  stageId?: string | null,
): Tone {
  const now = Date.now();
  const starts = startsAt ? new Date(startsAt).getTime() : NaN;
  const ends = endsAt ? new Date(endsAt).getTime() : NaN;
  const st = status.toUpperCase();

  if (
    stageId === 'ended' ||
    ['COMPLETED', 'CANCELLED', 'ENDED', 'SETTLED'].includes(st) ||
    (Number.isFinite(ends) && ends < now)
  ) {
    return { label: 'Zakończone', color: '#8E8E93', bg: 'rgba(142,142,147,0.14)' };
  }
  if (
    stageId === 'live' ||
    st === 'LIVE' ||
    (Number.isFinite(starts) && Number.isFinite(ends) && now >= starts && now <= ends)
  ) {
    return { label: 'Trwa', color: '#34C759', bg: 'rgba(52,199,89,0.16)' };
  }
  if (
    stageId === 'upcoming' ||
    (Number.isFinite(starts) && starts - now < 48 * 3600_000 && starts > now)
  ) {
    return { label: 'Wkrótce', color: '#FF9500', bg: 'rgba(255,149,0,0.16)' };
  }
  if (stageId === 'pending_approval') {
    return { label: 'Do akceptacji', color: '#FF9500', bg: 'rgba(255,149,0,0.16)' };
  }
  return {
    label: kind === 'auction' ? 'Potwierdzone' : 'Opublikowane',
    color: '#007AFF',
    bg: 'rgba(0,122,255,0.12)',
  };
}

function formatWhen(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleString('pl-PL', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMoney(n: number) {
  return `${Math.round(n).toLocaleString('pl-PL')} zł`;
}

export default function SellerActiveEventsPanel({
  token,
  openHouse,
  auction,
  stage,
  colors,
  onRequestLaunch,
}: Props) {
  const navigation = useNavigation<any>();
  const [ohDetail, setOhDetail] = useState<OpenHouseEventRecord | null>(null);
  const [auctionDetail, setAuctionDetail] = useState<AuctionEventRecord | null>(null);
  const [loadingOh, setLoadingOh] = useState(false);
  const [loadingAuction, setLoadingAuction] = useState(false);

  const ohEvent = openHouse.event;
  const auctionEvent = auction.event;
  const ohActive =
    ohEvent &&
    !['CANCELLED', 'COMPLETED'].includes(String(ohEvent.status || '').toUpperCase());
  const auctionActive =
    auctionEvent &&
    !['CANCELLED', 'ENDED', 'SETTLED'].includes(String(auctionEvent.status || '').toUpperCase());

  const loadDetails = useCallback(async () => {
    if (ohEvent?.id) {
      setLoadingOh(true);
      try {
        setOhDetail(await fetchOpenHouseEvent(token, ohEvent.id));
      } catch {
        setOhDetail(null);
      } finally {
        setLoadingOh(false);
      }
    } else {
      setOhDetail(null);
    }
    if (auctionEvent?.id) {
      setLoadingAuction(true);
      try {
        setAuctionDetail(await fetchAuctionEvent(token, auctionEvent.id));
      } catch {
        setAuctionDetail(null);
      } finally {
        setLoadingAuction(false);
      }
    } else {
      setAuctionDetail(null);
    }
  }, [token, ohEvent?.id, auctionEvent?.id]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  useEffect(() => {
    if (!ohEvent?.id && !auctionEvent?.id) return;
    const id = setInterval(() => void loadDetails(), 30_000);
    return () => clearInterval(id);
  }, [ohEvent?.id, auctionEvent?.id, loadDetails]);

  const ohReservations = useMemo(() => {
    if (!ohDetail?.slots) return [];
    return ohDetail.slots.flatMap((slot) =>
      slot.reservations.map((r) => ({
        ...r,
        slotStartsAt: slot.startsAt,
        slotEndsAt: slot.endsAt,
      })),
    );
  }, [ohDetail]);

  const pendingOh = openHouse.proposal;
  const pendingAuction = auction.proposal;

  const renderProposal = (proposal: NonNullable<Proposal>, kind: 'open_house' | 'auction') => {
    const parsed = parseSellerEventProposal(proposal.payload);
    const when = parsed?.startsAt ? formatWhen(parsed.startsAt) : '';
    return (
      <View
        key={`prop-${proposal.id}`}
        style={[styles.categoryBox, { borderColor: '#FF950044', backgroundColor: '#FF950012' }]}
      >
        <Text style={[styles.categoryKicker, { color: '#FF9500' }]}>CZEKA NA KLIENTA</Text>
        <Text style={{ color: colors.text, fontWeight: '800', marginTop: 4 }}>
          {kind === 'auction' ? 'Licytacja' : 'Dzień otwarty'} · {proposal.title}
        </Text>
        {when ? (
          <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 4 }}>Termin: {when}</Text>
        ) : null}
      </View>
    );
  };

  const renderOpenHouseCard = (event: EventSummary, ended: boolean) => {
    const tone = stageTone(
      'open_house',
      event.status,
      event.startsAt,
      event.endsAt,
      stage?.kind === 'open_house' ? stage.id : null,
    );
    const countdownTarget =
      event.startsAt && new Date(event.startsAt).getTime() > Date.now()
        ? event.startsAt
        : event.endsAt;
    const spots =
      ohDetail?.totalSpotsLeft != null ? ohDetail.totalSpotsLeft : null;

    return (
      <View
        key={`oh-${event.id}`}
        style={[
          styles.eventCard,
          {
            borderColor: `${tone.color}55`,
            backgroundColor: colors.card,
            opacity: ended ? 0.72 : 1,
          },
        ]}
      >
        <View style={styles.eventHeader}>
          <View style={[styles.toneChip, { backgroundColor: tone.bg }]}>
            <View style={[styles.toneDot, { backgroundColor: tone.color }]} />
            <Text style={{ color: tone.color, fontSize: 10, fontWeight: '900' }}>
              DZIEŃ OTWARTY · {tone.label.toUpperCase()}
            </Text>
          </View>
          {spots != null ? (
            <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '700' }}>
              Wolne: {spots}
            </Text>
          ) : null}
        </View>

        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16, marginTop: 8 }}>
          {event.title?.trim() || 'Dzień otwarty'}
        </Text>
        <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 4 }}>
          {formatWhen(event.startsAt)}
          {event.endsAt ? ` – ${formatWhen(event.endsAt)}` : ''}
        </Text>

        {!ended && countdownTarget ? (
          <View style={{ marginTop: 10 }}>
            <Text style={[styles.categoryKicker, { color: colors.secondary }]}>ODLICZANIE</Text>
            <LiveEventCountdown
              targetAt={countdownTarget}
              muted={colors.secondary}
              urgency
              compact={false}
            />
          </View>
        ) : null}

        <View style={{ marginTop: 12 }}>
          <Text style={[styles.categoryKicker, { color: colors.secondary }]}>REZERWACJE</Text>
          {loadingOh ? (
            <ActivityIndicator style={{ marginTop: 8 }} color={colors.accent} />
          ) : ohReservations.length === 0 ? (
            <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 6, lineHeight: 17 }}>
              Brak rezerwacji — udostępnij ogłoszenie albo zaproś kupujących.
            </Text>
          ) : (
            ohReservations.slice(0, 6).map((r) => (
              <View key={r.id} style={[styles.guestRow, { borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>
                    {r.userName}
                  </Text>
                  <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 2 }}>
                    {formatWhen(r.slotStartsAt)} · {r.guestCount} os.
                    {r.note ? ` · ${r.note}` : ''}
                  </Text>
                </View>
              </View>
            ))
          )}
          {ohReservations.length > 6 ? (
            <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 4 }}>
              +{ohReservations.length - 6} więcej w zarządzaniu
            </Text>
          ) : null}
        </View>

        <Pressable
          onPress={() => navigation.navigate('OpenHouseEvent', { eventId: event.id })}
          style={[styles.manageBtn, { borderColor: colors.accent }]}
        >
          <Text style={{ color: colors.accent, fontWeight: '800' }}>Zarządzaj wydarzeniem</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.accent} />
        </Pressable>
      </View>
    );
  };

  const renderAuctionCard = (event: EventSummary, ended: boolean) => {
    const detail = auctionDetail;
    const startsAt = detail?.startsAt || event.startsAt;
    const endsAt = detail?.effectiveEndsAt || detail?.endsAt || event.endsAt;
    const tone = stageTone(
      'auction',
      detail?.status || event.status,
      startsAt,
      endsAt,
      stage?.kind === 'auction' ? stage.id : null,
    );
    const countdownTarget =
      startsAt && new Date(startsAt).getTime() > Date.now() ? startsAt : endsAt;
    const price = detail?.currentPrice ?? event.startPrice;
    const bids = detail?.bidCount ?? 0;

    return (
      <View
        key={`au-${event.id}`}
        style={[
          styles.eventCard,
          {
            borderColor: `${tone.color}55`,
            backgroundColor: colors.card,
            opacity: ended ? 0.72 : 1,
          },
        ]}
      >
        <View style={styles.eventHeader}>
          <View style={[styles.toneChip, { backgroundColor: tone.bg }]}>
            <View style={[styles.toneDot, { backgroundColor: tone.color }]} />
            <Text style={{ color: tone.color, fontSize: 10, fontWeight: '900' }}>
              LICYTACJA · {tone.label.toUpperCase()}
            </Text>
          </View>
          <Text style={{ color: colors.secondary, fontSize: 11, fontWeight: '700' }}>
            Oferty: {loadingAuction ? '…' : bids}
          </Text>
        </View>

        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16, marginTop: 8 }}>
          {event.title?.trim() || detail?.title || 'Licytacja'}
        </Text>
        <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 4 }}>
          {formatWhen(startsAt)}
          {endsAt ? ` – ${formatWhen(endsAt)}` : ''}
        </Text>
        {price != null ? (
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15, marginTop: 6 }}>
            {ended ? 'Końcowa' : 'Aktualna'} cena: {formatMoney(Number(price))}
          </Text>
        ) : null}

        {!ended && countdownTarget ? (
          <View style={{ marginTop: 10 }}>
            <Text style={[styles.categoryKicker, { color: colors.secondary }]}>ODLICZANIE</Text>
            <LiveEventCountdown
              targetAt={countdownTarget}
              muted={colors.secondary}
              urgency
            />
          </View>
        ) : null}

        <View style={{ marginTop: 12 }}>
          <Text style={[styles.categoryKicker, { color: colors.secondary }]}>OFERTY</Text>
          {loadingAuction ? (
            <ActivityIndicator style={{ marginTop: 8 }} color={colors.accent} />
          ) : bids === 0 ? (
            <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 6, lineHeight: 17 }}>
              Brak ofert — poczekaj na start albo przypomnij zainteresowanym.
            </Text>
          ) : (
            (detail?.recentBids || []).slice(0, 4).map((b) => (
              <View key={b.id} style={[styles.guestRow, { borderColor: colors.border }]}>
                <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>
                  {b.bidderLabel}
                </Text>
                <Text style={{ color: colors.accent, fontWeight: '800' }}>
                  {formatMoney(b.amount)}
                </Text>
              </View>
            ))
          )}
        </View>

        <Pressable
          onPress={() => navigation.navigate('AuctionEvent', { eventId: event.id })}
          style={[styles.manageBtn, { borderColor: colors.accent }]}
        >
          <Text style={{ color: colors.accent, fontWeight: '800' }}>Zarządzaj licytacją</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.accent} />
        </Pressable>
      </View>
    );
  };

  const activeCards: React.ReactNode[] = [];
  const endedCards: React.ReactNode[] = [];

  if (ohEvent) {
    const ended = !ohActive;
    const card = renderOpenHouseCard(ohEvent, Boolean(ended));
    if (ended) endedCards.push(card);
    else activeCards.push(card);
  }
  if (auctionEvent) {
    const ended = !auctionActive;
    const card = renderAuctionCard(auctionEvent, Boolean(ended));
    if (ended) endedCards.push(card);
    else activeCards.push(card);
  }

  const hasAnything =
    activeCards.length > 0 ||
    endedCards.length > 0 ||
    pendingOh ||
    pendingAuction;

  if (!hasAnything) return null;

  return (
    <View style={{ gap: 10, marginTop: 10 }}>
      {pendingOh ? renderProposal(pendingOh, 'open_house') : null}
      {pendingAuction ? renderProposal(pendingAuction, 'auction') : null}

      {activeCards.length > 0 ? (
        <View style={{ gap: 10 }}>
          <Text style={[styles.categoryKicker, { color: colors.secondary }]}>AKTYWNE</Text>
          {activeCards}
        </View>
      ) : null}

      {endedCards.length > 0 ? (
        <View style={{ gap: 10 }}>
          <Text style={[styles.categoryKicker, { color: colors.secondary }]}>ZAKOŃCZONE</Text>
          {endedCards}
        </View>
      ) : null}

      {(!ohActive || !auctionActive) && onRequestLaunch ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {!ohActive ? (
            <Pressable
              onPress={() => onRequestLaunch('open_house')}
              style={[styles.secondaryChip, { borderColor: colors.border, backgroundColor: colors.input }]}
            >
              <Text style={{ color: colors.text, fontSize: 11, fontWeight: '700' }}>
                + Nowy dzień otwarty
              </Text>
            </Pressable>
          ) : null}
          {!auctionActive ? (
            <Pressable
              onPress={() => onRequestLaunch('auction')}
              style={[styles.secondaryChip, { borderColor: colors.border, backgroundColor: colors.input }]}
            >
              <Text style={{ color: colors.text, fontSize: 11, fontWeight: '700' }}>
                + Nowa licytacja
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Summary counts for metrics strip. */
export function sellerEventsMetricSummary(input: {
  openHouseEvent: EventSummary | null | undefined;
  auctionEvent: EventSummary | null | undefined;
  reservationCount?: number;
}): { label: string; highlight: boolean } {
  const oh = input.openHouseEvent;
  const au = input.auctionEvent;
  const now = Date.now();
  const live =
    (oh &&
      oh.startsAt &&
      oh.endsAt &&
      now >= new Date(oh.startsAt).getTime() &&
      now <= new Date(oh.endsAt).getTime()) ||
    String(au?.status || '').toUpperCase() === 'LIVE';
  if (live) return { label: 'live', highlight: true };
  if (oh || au) {
    const n = input.reservationCount;
    if (typeof n === 'number' && n > 0) return { label: String(n), highlight: false };
    return { label: '1', highlight: false };
  }
  return { label: '0', highlight: false };
}

const styles = StyleSheet.create({
  categoryKicker: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  categoryBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
  },
  eventCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  toneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  toneDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  guestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
  },
  manageBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  secondaryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
});

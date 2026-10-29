import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  formatDealWhen,
  formatPln,
  parseAmount,
  type BuyerDeal,
  type DealAction,
  type NegotiationOffer,
  type TransactionStepId,
} from '../../services/offerBuyerService';
import { API_URL } from '../../config/network';

const appleType = Platform.select({
  ios: { fontFamily: 'System' as const },
  android: { fontFamily: 'sans-serif' as const },
  default: {},
});

export type StepColors = { card: string; text: string; secondary: string; border: string; input: string };
type Act = (key: string, body: DealAction) => Promise<{ ok: boolean; otherActive: number }>;
type PickDate = (title: string, initial: string | null | undefined, onSelect: (iso: string) => void) => void;

const OFFER_STATUS: Record<NegotiationOffer['status'], { label: string; color: string }> = {
  open: { label: 'otwarta', color: '#FF9500' },
  accepted: { label: 'uzgodniona', color: '#34C759' },
  rejected: { label: 'odrzucona', color: '#FF3B30' },
  countered: { label: 'kontroferta', color: '#8E8E93' },
  withdrawn: { label: 'wycofana', color: '#8E8E93' },
};

function Chip({ label, active, onPress, colors }: { label: string; active: boolean; onPress: () => void; colors: StepColors }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { borderColor: active ? '#FF9500' : colors.border, backgroundColor: active ? 'rgba(255,149,0,0.12)' : 'transparent' }]}
    >
      <Text style={[styles.chipText, appleType, { color: colors.text, fontWeight: active ? '700' : '500' }]}>{label}</Text>
    </Pressable>
  );
}

function Btn({
  label,
  icon,
  onPress,
  colors,
  primary,
  danger,
  disabled,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  colors: StepColors;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        primary ? styles.btnPrimary : { borderColor: colors.border },
        { opacity: disabled ? 0.45 : pressed ? 0.7 : 1 },
      ]}
    >
      {icon ? <Ionicons name={icon} size={15} color={primary ? '#fff' : danger ? '#FF3B30' : colors.text} /> : null}
      <Text style={[styles.btnText, appleType, { color: primary ? '#fff' : danger ? '#FF3B30' : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function DateField({ label, value, onPress, colors }: { label: string; value: string | null | undefined; onPress: () => void; colors: StepColors }) {
  return (
    <Pressable onPress={onPress} style={[styles.field, { backgroundColor: colors.input }]}>
      <Text style={[styles.fieldLabel, appleType, { color: colors.secondary }]}>{label}</Text>
      <Text style={[styles.fieldValue, appleType, { color: value ? colors.text : colors.secondary }]}>{value ? formatDealWhen(value) : 'Wybierz'}</Text>
    </Pressable>
  );
}

/* ───────────────────────── 3 · Negocjacje ───────────────────────── */

/* ───────────────────────── etap jako akordeon ───────────────────────── */

export function PhaseCard({
  phase,
  index,
  open,
  onToggle,
  colors,
  children,
}: {
  phase: BuyerDeal['phases'][number];
  index: number;
  open: boolean;
  onToggle: () => void;
  colors: StepColors;
  children: React.ReactNode;
}) {
  const tint = phase.done ? '#34C759' : phase.current ? '#FF9500' : colors.secondary;
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: phase.current ? 'rgba(255,149,0,0.55)' : colors.border, opacity: !phase.done && !phase.current && !open ? 0.6 : 1 }]}>
      <Pressable onPress={onToggle} style={styles.phaseHead} hitSlop={6}>
        <View style={[styles.phaseNum, { backgroundColor: phase.done ? '#34C759' : phase.current ? '#FF9500' : colors.input }]}>
          {phase.done ? <Ionicons name="checkmark" size={14} color="#fff" /> : <Text style={[styles.phaseNumText, { color: phase.current ? '#fff' : colors.secondary }]}>{index + 1}</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, appleType, { color: colors.text, marginBottom: 0 }]}>{phase.label}</Text>
          {phase.summary || phase.current ? (
            <Text style={[styles.small, appleType, { color: tint }]} numberOfLines={1}>
              {phase.current ? 'Teraz' : phase.summary}
            </Text>
          ) : null}
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.secondary} />
      </Pressable>
      {open ? <View style={{ marginTop: 6 }}>{children}</View> : null}
    </View>
  );
}

function hoursLeft(deadline: string): string {
  const hours = Math.round((new Date(deadline).getTime() - Date.now()) / 3_600_000);
  return hours > 0 ? `zostało ${hours} h` : 'czas minął';
}

const SIDE_LABEL = { agent: 'Ty', buyer: 'kupujący', seller: 'sprzedający' } as const;

/** Pasek „kto ma ruch” z zegarem 48 h — na górze ekranu i w negocjacjach. */
export function TurnBanner({ deal, colors }: { deal: BuyerDeal; colors: StepColors }) {
  const turn = deal.turn;
  if (!turn?.side || !['negotiation'].includes(deal.stage)) return null;
  const mine = turn.side === 'agent';
  return (
    <View style={[styles.banner, { backgroundColor: mine ? 'rgba(255,149,0,0.14)' : 'rgba(0,122,255,0.10)' }]}>
      <Ionicons name={mine ? 'hand-left-outline' : 'time-outline'} size={18} color={mine ? '#FF9500' : '#007AFF'} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.bannerText, appleType, { color: colors.text, fontSize: 14 }]}>Ruch: {SIDE_LABEL[turn.side]}</Text>
        <Text style={[styles.small, appleType, { color: colors.secondary }]}>{turn.label}</Text>
      </View>
      {turn.deadline ? <Text style={[styles.offerStatus, appleType, { color: '#007AFF' }]}>{hoursLeft(turn.deadline)}</Text> : null}
    </View>
  );
}

/* ───────────────────────── Negocjacje: ping-pong ───────────────────────── */

const RESPONSE_LABEL = { accept: 'przyjmuje', reject: 'odrzuca', counter: 'proponuje' } as const;

export function NegotiationSection({ deal, colors, act }: { deal: BuyerDeal; colors: StepColors; act: Act }) {
  const neg = deal.negotiation;
  const started = Boolean(neg.startedAt || neg.offers.length || neg.financing);
  const closed = deal.status === 'LOST';
  const open = deal.turn?.offerId ? neg.offers.find((offer) => offer.id === deal.turn.offerId) || null : null;
  const [by, setBy] = useState<'buyer' | 'seller'>(open?.by === 'buyer' ? 'seller' : 'buyer');
  const [amount, setAmount] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [phoneReply, setPhoneReply] = useState<'counter' | null>(null);
  const [counter, setCounter] = useState('');
  const [financing, setFinancing] = useState(neg.financing || { kind: 'cash' as const, bank: '', decision: 'none' as const });

  useEffect(() => {
    setFinancing(neg.financing || { kind: 'cash', bank: '', decision: 'none' });
    setPhoneReply(null);
    setCounter('');
  }, [deal.updatedAt]);

  if (!started) {
    return (
      <>
        <Text style={[styles.small, appleType, { color: colors.secondary }]}>Kupujący chce kupić? Zapiszemy jego propozycję ceny i zaczniemy wymianę ofert ze sprzedającym.</Text>
        {!closed ? (
          <View style={styles.row}>
            <Btn
              label="Klient kupuje — negocjacje"
              icon="cash-outline"
              primary
              colors={colors}
              onPress={() =>
                Alert.alert('Przejść do negocjacji?', deal.presentation?.heldAt ? 'Zapiszesz propozycję ceny kupującego.' : 'Prezentację i opinię oznaczymy jako pominięte.', [
                  { text: 'Anuluj', style: 'cancel' },
                  { text: 'Przejdź', onPress: () => void act('neg', { action: 'start_negotiation', dealId: deal.id }) },
                ])
              }
            />
          </View>
        ) : null}
      </>
    );
  }

  const other = open ? (open.by === 'buyer' ? 'seller' : 'buyer') : null;
  const otherReachable = other === 'seller' ? Boolean(deal.seller) : deal.buyer.kind === 'client';
  const sent = open ? Boolean(open.by === 'buyer' ? open.sentToSellerAt : open.sentToBuyerAt) : false;

  const saveOffer = async () => {
    const value = parseAmount(amount);
    if (!value) return Alert.alert('Propozycja', 'Podaj kwotę.');
    const res = await act('offer', { action: 'add_offer', dealId: deal.id, by, amount: value });
    if (res.ok) setAmount('');
  };
  const record = (kind: 'accept' | 'reject' | 'counter') => {
    if (!open) return;
    const value = kind === 'counter' ? parseAmount(counter) : null;
    if (kind === 'counter' && !value) return Alert.alert('Kontroferta', 'Podaj kwotę.');
    void act(`resp-${open.id}`, { action: 'record_response', dealId: deal.id, offerId: open.id, kind, amount: value });
  };

  return (
    <>
      {neg.skippedPresentation ? <Text style={[styles.small, appleType, { color: colors.secondary }]}>Bez prezentacji — klient od razu kupuje.</Text> : null}
      {neg.agreedPrice ? (
        <View style={[styles.banner, { backgroundColor: 'rgba(52,199,89,0.12)' }]}>
          <Ionicons name="checkmark-circle" size={18} color="#34C759" />
          <Text style={[styles.bannerText, appleType, { color: colors.text }]}>Cena uzgodniona: {formatPln(neg.agreedPrice)}</Text>
        </View>
      ) : (
        <TurnBanner deal={deal} colors={colors} />
      )}

      {/* Bieżąca propozycja i jedna właściwa akcja */}
      {open && !closed && !neg.agreedPrice ? (
        <View style={[styles.offer, { borderColor: colors.border }]}>
          <View style={styles.offerHead}>
            <Text style={[styles.offerWho, appleType, { color: open.by === 'buyer' ? '#C25E00' : '#1F8A44' }]}>{open.by === 'buyer' ? 'Kupujący' : 'Sprzedający'}</Text>
            <Text style={[styles.offerAmount, appleType, { color: colors.text }]}>{formatPln(open.amount)}</Text>
          </View>
          {open.note ? <Text style={[styles.small, appleType, { color: colors.text }]}>{open.note}</Text> : null}

          {open.response ? (
            <>
              <Text style={[styles.small, appleType, { color: colors.text, marginTop: 6 }]}>
                {other === 'seller' ? 'Sprzedający' : 'Kupujący'} {RESPONSE_LABEL[open.response.kind]}
                {open.response.kind === 'counter' && open.response.amount ? ` ${formatPln(open.response.amount)}` : ` ${formatPln(open.amount)}`}
                {open.response.comment ? ` — „${open.response.comment}”` : ''}
              </Text>
              <View style={styles.row}>
                <Btn
                  label={open.response.kind === 'accept' ? 'Potwierdź uzgodnienie' : open.response.kind === 'counter' ? `Zatwierdź i wyślij do ${open.by === 'buyer' ? 'kupującego' : 'sprzedającego'}` : 'Zatwierdź odmowę'}
                  icon="checkmark"
                  primary
                  colors={colors}
                  onPress={() => void act(`ok-${open.id}`, { action: 'approve_response', dealId: deal.id, offerId: open.id })}
                />
              </View>
            </>
          ) : !sent ? (
            <>
              {otherReachable && open.by === 'buyer' ? (
                <TextInput
                  value={recommendation}
                  onChangeText={setRecommendation}
                  placeholder="Twoja rekomendacja dla sprzedającego (opcjonalnie)"
                  placeholderTextColor={colors.secondary}
                  style={[styles.input, styles.inputSingle, { color: colors.text, backgroundColor: colors.input }]}
                />
              ) : null}
              <View style={styles.row}>
                <Btn
                  label={otherReachable ? `Zatwierdź i wyślij do ${other === 'seller' ? 'sprzedającego' : 'kupującego'}` : 'Przekazane telefonicznie'}
                  icon="paper-plane-outline"
                  primary
                  colors={colors}
                  onPress={() => void act(`send-${open.id}`, { action: 'send_offer', dealId: deal.id, offerId: open.id, recommendation: recommendation.trim() || undefined })}
                />
              </View>
              {otherReachable ? (
                <Text style={[styles.tiny, appleType, { color: colors.secondary }]}>
                  {other === 'seller' ? 'Sprzedający zobaczy ją jako „Kupujący N”, bez danych kupującego.' : 'Kupujący dostanie ją w panelu z przyciskami odpowiedzi.'} Czas na odpowiedź: 48 h.
                </Text>
              ) : null}
            </>
          ) : (
            <>
              <Text style={[styles.tiny, appleType, { color: colors.secondary }]}>
                Wysłano {formatDealWhen((open.by === 'buyer' ? open.sentToSellerAt : open.sentToBuyerAt) || open.at)}. Odpowiedź przyszła telefonicznie? Zapisz ją:
              </Text>
              <View style={styles.row}>
                <Chip label="Przyjmuje" active={false} colors={colors} onPress={() => record('accept')} />
                <Chip label="Kontroferta" active={phoneReply === 'counter'} colors={colors} onPress={() => setPhoneReply(phoneReply ? null : 'counter')} />
                <Chip label="Odrzuca" active={false} colors={colors} onPress={() => record('reject')} />
              </View>
              {phoneReply === 'counter' ? (
                <View style={styles.row}>
                  <TextInput
                    value={counter}
                    onChangeText={setCounter}
                    placeholder="Kwota"
                    placeholderTextColor={colors.secondary}
                    keyboardType="number-pad"
                    style={[styles.input, styles.inputSingle, { flex: 1, marginTop: 0, color: colors.text, backgroundColor: colors.input }]}
                  />
                  <Btn label="Zapisz i wyślij" primary colors={colors} onPress={() => record('counter')} />
                </View>
              ) : null}
            </>
          )}
        </View>
      ) : null}

      {/* Nowa propozycja — gdy nic nie czeka */}
      {!open && !closed && !neg.agreedPrice ? (
        <View style={[styles.box, { backgroundColor: colors.input }]}>
          <View style={styles.row}>
            <Chip label="Kupujący proponuje" active={by === 'buyer'} colors={colors} onPress={() => setBy('buyer')} />
            <Chip label="Sprzedający chce" active={by === 'seller'} colors={colors} onPress={() => setBy('seller')} />
          </View>
          <View style={styles.row}>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder="Kwota, np. 520 000"
              placeholderTextColor={colors.secondary}
              keyboardType="number-pad"
              style={[styles.input, styles.inputSingle, { flex: 1, marginTop: 0, color: colors.text, backgroundColor: colors.card }]}
            />
            <Btn label="Zapisz" icon="add" primary colors={colors} disabled={!amount.trim()} onPress={() => void saveOffer()} />
          </View>
        </View>
      ) : null}

      {/* Historia ofert w jednej kolumnie */}
      {neg.offers.length ? (
        <>
          <Text style={[styles.kicker, appleType, { color: colors.secondary }]}>HISTORIA CEN</Text>
          {[...neg.offers].reverse().map((offer) => {
            const st = OFFER_STATUS[offer.status];
            return (
              <View key={offer.id} style={styles.histRow}>
                <Text style={[styles.offerWho, appleType, { color: offer.by === 'buyer' ? '#C25E00' : '#1F8A44' }]}>{offer.by === 'buyer' ? 'Kupujący' : 'Sprzedający'}</Text>
                <Text style={[styles.histAmount, appleType, { color: colors.text }]}>{formatPln(offer.amount)}</Text>
                <Text style={[styles.offerStatus, appleType, { color: st.color }]}>{st.label}</Text>
              </View>
            );
          })}
        </>
      ) : null}

      <Text style={[styles.kicker, appleType, { color: colors.secondary }]}>FINANSOWANIE KUPUJĄCEGO</Text>
      <View style={styles.row}>
        {(
          [
            ['cash', 'Gotówka'],
            ['mortgage', 'Kredyt'],
            ['mixed', 'Gotówka + kredyt'],
          ] as const
        ).map(([key, label]) => (
          <Chip
            key={key}
            label={label}
            active={financing.kind === key}
            colors={colors}
            onPress={() => {
              const next = { ...financing, kind: key };
              setFinancing(next);
              void act('fin', { action: 'set_negotiation', dealId: deal.id, financing: { kind: next.kind, bank: next.bank || undefined, decision: next.decision || 'none' } });
            }}
          />
        ))}
      </View>
      {financing.kind !== 'cash' ? (
        <View style={styles.row}>
          {(
            [
              ['pending', 'Decyzja w toku'],
              ['approved', 'Pozytywna'],
              ['rejected', 'Odmowa'],
            ] as const
          ).map(([key, label]) => (
            <Chip
              key={key}
              label={label}
              active={financing.decision === key}
              colors={colors}
              onPress={() => {
                const next = { ...financing, decision: key };
                setFinancing(next);
                void act('fin', { action: 'set_negotiation', dealId: deal.id, financing: { kind: next.kind, bank: next.bank || undefined, decision: key } });
              }}
            />
          ))}
        </View>
      ) : null}
    </>
  );
}

/* ───────────────────────── Rezerwacja (po uzgodnieniu ceny) ───────────────────────── */

export function ReservationSection({
  deal,
  colors,
  act,
  pickDate,
  askAboutOthers,
}: {
  deal: BuyerDeal;
  colors: StepColors;
  act: Act;
  pickDate: PickDate;
  askAboutOthers: (count: number) => void;
}) {
  const neg = deal.negotiation;
  const closed = deal.status === 'LOST';
  const [deposit, setDeposit] = useState(neg.terms?.deposit ? String(neg.terms.deposit) : '');
  const [terms, setTerms] = useState({ preliminaryAt: neg.terms?.preliminaryAt || null, deedAt: neg.terms?.deedAt || null, handoverAt: neg.terms?.handoverAt || null });
  useEffect(() => {
    setDeposit(neg.terms?.deposit ? String(neg.terms.deposit) : '');
    setTerms({ preliminaryAt: neg.terms?.preliminaryAt || null, deedAt: neg.terms?.deedAt || null, handoverAt: neg.terms?.handoverAt || null });
  }, [deal.updatedAt]);

  if (!neg.agreedPrice && !neg.reservation) {
    return <Text style={[styles.small, appleType, { color: colors.secondary }]}>Otworzy się po uzgodnieniu ceny.</Text>;
  }
  const reserve = () =>
    pickDate('Rezerwacja do', neg.reservation?.until, async (iso) => {
      const res = await act('res', { action: 'set_reservation', dealId: deal.id, until: iso });
      if (res.ok && res.otherActive) askAboutOthers(res.otherActive);
    });

  return (
    <>
      {neg.reservation ? (
        <View style={[styles.banner, { backgroundColor: 'rgba(175,82,222,0.12)' }]}>
          <Ionicons name="lock-closed" size={16} color="#AF52DE" />
          <Text style={[styles.small, appleType, { color: colors.text, flex: 1 }]}>
            Zarezerwowane do {formatDealWhen(neg.reservation.until)}
            {neg.othersDecision === 'paused' ? ' · pozostali wstrzymani' : neg.othersDecision === 'backup' ? ' · pozostali rezerwowi' : ''}
          </Text>
        </View>
      ) : null}
      {!closed ? (
        <View style={styles.row}>
          <Btn label={neg.reservation ? 'Zmień datę rezerwacji' : 'Zarezerwuj'} icon="lock-closed-outline" primary={!neg.reservation} colors={colors} onPress={reserve} />
          {!neg.reservation && !neg.reservationSkipped ? <Btn label="Bez rezerwacji" colors={colors} onPress={() => void act('skip', { action: 'skip_reservation', dealId: deal.id })} /> : null}
          {neg.reservation ? <Btn label="Zdejmij" danger colors={colors} onPress={() => void act('res', { action: 'set_reservation', dealId: deal.id, until: null })} /> : null}
        </View>
      ) : null}

      <Text style={[styles.kicker, appleType, { color: colors.secondary }]}>ZADATEK I TERMINY</Text>
      <TextInput
        value={deposit}
        onChangeText={setDeposit}
        placeholder="Zadatek, np. 50 000"
        placeholderTextColor={colors.secondary}
        keyboardType="number-pad"
        style={[styles.input, styles.inputSingle, { color: colors.text, backgroundColor: colors.input }]}
      />
      <View style={styles.fields}>
        <DateField label="Umowa przedwstępna" value={terms.preliminaryAt} colors={colors} onPress={() => pickDate('Umowa przedwstępna', terms.preliminaryAt, (iso) => setTerms({ ...terms, preliminaryAt: iso }))} />
        <DateField label="Akt notarialny" value={terms.deedAt} colors={colors} onPress={() => pickDate('Akt notarialny', terms.deedAt, (iso) => setTerms({ ...terms, deedAt: iso }))} />
        <DateField label="Przekazanie kluczy" value={terms.handoverAt} colors={colors} onPress={() => pickDate('Przekazanie kluczy', terms.handoverAt, (iso) => setTerms({ ...terms, handoverAt: iso }))} />
      </View>
      {!closed ? (
        <View style={styles.row}>
          <Btn label="Zapisz terminy" primary colors={colors} onPress={() => void act('terms', { action: 'set_negotiation', dealId: deal.id, terms: { deposit: parseAmount(deposit), ...terms } })} />
        </View>
      ) : null}
    </>
  );
}

/* ───────────────────────── 4 · Transakcja ───────────────────────── */

const STEPS: Array<{
  id: TransactionStepId;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  place?: string;
  amount?: string;
  done: string;
  file: string;
}> = [
  { id: 'preliminary', title: 'Umowa przedwstępna', icon: 'document-text-outline', place: 'Kancelaria / miejsce', amount: 'Zadatek', done: 'Podpisana', file: 'Skan umowy' },
  { id: 'deed', title: 'Akt notarialny', icon: 'ribbon-outline', place: 'Kancelaria notarialna', amount: 'Cena w akcie', done: 'Podpisany', file: 'Skan aktu' },
  { id: 'handover', title: 'Przekazanie kluczy', icon: 'key-outline', place: 'Stany liczników / uwagi', done: 'Przekazane', file: 'Protokół zdawczo-odbiorczy' },
  { id: 'commission', title: 'Prowizja', icon: 'cash-outline', amount: 'Kwota prowizji', done: 'Rozliczona', file: 'Faktura' },
];

function StepCard({
  deal,
  step,
  colors,
  act,
  pickDate,
  pickFile,
  askAboutOthers,
}: {
  deal: BuyerDeal;
  step: (typeof STEPS)[number];
  colors: StepColors;
  act: Act;
  pickDate: PickDate;
  pickFile: (kind: TransactionStepId) => void;
  askAboutOthers: (count: number) => void;
}) {
  const state = deal.transaction[step.id] || {};
  const terms = deal.negotiation.terms || {};
  const plannedDate =
    state.date || (step.id === 'preliminary' ? terms.preliminaryAt : step.id === 'deed' ? terms.deedAt : step.id === 'handover' ? terms.handoverAt : null);
  const [place, setPlace] = useState(state.place || '');
  const [amount, setAmount] = useState(state.amount ? String(state.amount) : step.id === 'preliminary' && terms.deposit ? String(terms.deposit) : '');
  const [editing, setEditing] = useState(false);
  const closed = deal.status === 'LOST';

  const toggleDone = async () => {
    const res = await act(`done-${step.id}`, { action: 'set_step', dealId: deal.id, step: step.id, done: !state.done });
    if (res.ok && res.otherActive) askAboutOthers(res.otherActive);
  };

  return (
    <View style={[styles.step, { borderColor: state.done ? '#34C759' : colors.border }]}>
      <View style={styles.offerHead}>
        <View style={[styles.stepIcon, { backgroundColor: state.done ? 'rgba(52,199,89,0.14)' : colors.input }]}>
          <Ionicons name={state.done ? 'checkmark' : step.icon} size={16} color={state.done ? '#34C759' : colors.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.stepTitle, appleType, { color: colors.text }]}>{step.title}</Text>
          <Text style={[styles.tiny, appleType, { color: state.done ? '#34C759' : colors.secondary }]}>
            {state.done
              ? `${step.done}${state.doneAt ? ` · ${formatDealWhen(state.doneAt)}` : ''}`
              : plannedDate
                ? `Termin: ${formatDealWhen(plannedDate)}`
                : 'Bez terminu'}
          </Text>
        </View>
        {!closed ? (
          <Pressable onPress={() => setEditing((v) => !v)} hitSlop={8}>
            <Ionicons name={editing ? 'chevron-up' : 'create-outline'} size={18} color={colors.secondary} />
          </Pressable>
        ) : null}
      </View>
      {state.place || state.amount ? (
        <Text style={[styles.small, appleType, { color: colors.text, marginTop: 6 }]}>
          {[state.place, state.amount ? `${step.amount}: ${formatPln(state.amount)}` : null].filter(Boolean).join(' · ')}
        </Text>
      ) : null}
      {state.fileUrl ? (
        <Pressable onPress={() => Linking.openURL(state.fileUrl!.startsWith('http') ? state.fileUrl! : `${API_URL}${state.fileUrl}`)}>
          <Text style={[styles.small, appleType, { color: '#007AFF', marginTop: 4 }]}>
            {step.file}: {state.fileName || 'otwórz'}
          </Text>
        </Pressable>
      ) : null}
      {editing ? (
        <View style={{ marginTop: 8 }}>
          {step.id !== 'commission' ? (
            <DateField
              label="Termin"
              value={plannedDate}
              colors={colors}
              onPress={() => pickDate(step.title, plannedDate, (iso) => void act(`date-${step.id}`, { action: 'set_step', dealId: deal.id, step: step.id, date: iso }))}
            />
          ) : null}
          {step.place ? (
            <TextInput
              value={place}
              onChangeText={setPlace}
              placeholder={step.place}
              placeholderTextColor={colors.secondary}
              style={[styles.input, styles.inputSingle, { color: colors.text, backgroundColor: colors.input }]}
            />
          ) : null}
          {step.amount ? (
            <TextInput
              value={amount}
              onChangeText={setAmount}
              placeholder={step.amount}
              placeholderTextColor={colors.secondary}
              keyboardType="number-pad"
              style={[styles.input, styles.inputSingle, { color: colors.text, backgroundColor: colors.input }]}
            />
          ) : null}
          <View style={styles.row}>
            <Btn
              label="Zapisz"
              primary
              colors={colors}
              onPress={async () => {
                const res = await act(`save-${step.id}`, {
                  action: 'set_step',
                  dealId: deal.id,
                  step: step.id,
                  ...(step.place ? { place } : {}),
                  ...(step.amount ? { amount: parseAmount(amount) } : {}),
                });
                if (res.ok) setEditing(false);
              }}
            />
            <Btn label={state.fileUrl ? `Zmień plik` : step.file} icon="document-attach-outline" colors={colors} onPress={() => pickFile(step.id)} />
          </View>
        </View>
      ) : null}
      {!closed ? (
        <View style={styles.row}>
          <Btn
            label={state.done ? 'Cofnij oznaczenie' : `Oznacz: ${step.done.toLowerCase()}`}
            icon={state.done ? 'arrow-undo-outline' : 'checkmark-done-outline'}
            primary={!state.done}
            colors={colors}
            onPress={() => void toggleDone()}
          />
        </View>
      ) : null}
    </View>
  );
}

export function TransactionSection(props: {
  deal: BuyerDeal;
  colors: StepColors;
  act: Act;
  pickDate: PickDate;
  pickFile: (kind: TransactionStepId) => void;
  askAboutOthers: (count: number) => void;
}) {
  const { deal, colors } = props;
  return (
    <>
      {STEPS.map((step) => (
        <StepCard key={step.id} step={step} {...props} />
      ))}
    </>
  );
}

/* ───────────────────────── Dokumenty (wybiera agent) ───────────────────────── */

type ToolDoc = {
  key: string;
  label: string;
  hint?: string | null;
  required: boolean;
  status: 'missing' | 'uploaded' | 'accepted' | 'rejected' | 'na';
  fileName: string | null;
  fileUrl: string | null;
};
type Suggestion = { key: string; label: string; hint: string | null; required: boolean };

const DOC_STATUS: Record<ToolDoc['status'], { label: string; color: string }> = {
  missing: { label: 'brakuje', color: '#8E8E93' },
  uploaded: { label: 'do sprawdzenia', color: '#FF9F0A' },
  accepted: { label: 'gotowe', color: '#34C759' },
  rejected: { label: 'do poprawy', color: '#FF453A' },
  na: { label: 'nie dotyczy', color: '#8E8E93' },
};

function DocumentsPanel({ token, clientId, title, colors }: { token: string; clientId: number; title: string; colors: StepColors }) {
  const endpoint = `${API_URL}/api/crm/clients/${clientId}/portal-tools`;
  const [docs, setDocs] = useState<ToolDoc[] | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.tools) {
      setDocs(json.tools.documents || []);
      setSuggestions(json.tools.documentSuggestions || []);
    }
  }, [endpoint, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (payload: Record<string, unknown>) => {
    setBusy(true);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      Alert.alert('Dokumenty', String(json?.error || 'Nie udało się.'));
      return false;
    }
    await load();
    return true;
  };

  return (
    <View style={[styles.box, { backgroundColor: colors.input }]}>
      <Text style={[styles.stepTitle, appleType, { color: colors.text }]}>{title}</Text>
      {docs === null ? <ActivityIndicator style={{ marginVertical: 8 }} /> : null}
      {docs && !docs.length ? (
        <Text style={[styles.small, appleType, { color: colors.secondary }]}>Nie prosisz jeszcze o żadne dokumenty — klient nic nie widzi.</Text>
      ) : null}
      {docs?.map((doc) => {
        const st = DOC_STATUS[doc.status];
        return (
          <View key={doc.key} style={[styles.docRow, { borderTopColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.small, appleType, { color: colors.text, fontWeight: '600' }]}>{doc.label}</Text>
              <Text style={[styles.tiny, appleType, { color: st.color }]}>{st.label}</Text>
              {doc.fileUrl ? (
                <Pressable onPress={() => Linking.openURL(doc.fileUrl!.startsWith('http') ? doc.fileUrl! : `${API_URL}${doc.fileUrl}`)}>
                  <Text style={[styles.tiny, appleType, { color: '#007AFF' }]}>{doc.fileName || 'Podgląd'}</Text>
                </Pressable>
              ) : null}
            </View>
            {doc.status === 'uploaded' ? (
              <>
                <Pressable onPress={() => void post({ action: 'review_document', itemKey: doc.key, status: 'accepted' })} hitSlop={8}>
                  <Ionicons name="checkmark-circle" size={24} color="#34C759" />
                </Pressable>
                <Pressable onPress={() => void post({ action: 'review_document', itemKey: doc.key, status: 'rejected' })} hitSlop={8}>
                  <Ionicons name="close-circle" size={24} color="#FF453A" />
                </Pressable>
              </>
            ) : null}
            <Pressable onPress={() => void post({ action: 'remove_document', itemKey: doc.key })} hitSlop={8}>
              <Ionicons name="trash-outline" size={18} color={colors.secondary} />
            </Pressable>
          </View>
        );
      })}
      {suggestions.length ? (
        <>
          <Text style={[styles.tiny, appleType, { color: colors.secondary, marginTop: 10, fontWeight: '700' }]}>TYPOWE — zaznacz, o które prosisz</Text>
          <View style={styles.row}>
            {suggestions.map((item) => (
              <Chip
                key={item.key}
                label={item.label}
                active={picked.includes(item.key)}
                colors={colors}
                onPress={() => setPicked((cur) => (cur.includes(item.key) ? cur.filter((k) => k !== item.key) : [...cur, item.key]))}
              />
            ))}
          </View>
          {picked.length ? (
            <View style={styles.row}>
              <Btn
                label={`Poproś o zaznaczone · ${picked.length}`}
                primary
                disabled={busy}
                colors={colors}
                onPress={async () => {
                  if (await post({ action: 'add_suggested_documents', keys: picked })) setPicked([]);
                }}
              />
            </View>
          ) : null}
        </>
      ) : null}
      <TextInput
        value={custom}
        onChangeText={setCustom}
        placeholder="Inny dokument, np. zgoda banku na wykreślenie hipoteki"
        placeholderTextColor={colors.secondary}
        style={[styles.input, styles.inputSingle, { color: colors.text, backgroundColor: colors.card }]}
      />
      {custom.trim() ? (
        <View style={styles.row}>
          <Btn
            label="Dodaj"
            icon="add"
            colors={colors}
            disabled={busy}
            onPress={async () => {
              if (await post({ action: 'add_document', label: custom.trim() })) setCustom('');
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

export function DocumentsSection({ deal, token, colors, act }: { deal: BuyerDeal; token: string; colors: StepColors; act: Act }) {
  return (
    <View>
      <Text style={[styles.kicker, appleType, { color: colors.secondary }]}>DOKUMENTY</Text>
      {!deal.documentsVisible ? (
        <>
          <Text style={[styles.small, appleType, { color: colors.secondary }]}>
            Pojawią się, gdy cena będzie uzgodniona albo zrobisz rezerwację. Klienci zobaczą tylko te dokumenty, o które poprosisz.
          </Text>
          <View style={styles.row}>
            <Btn label="Przygotuj dokumenty teraz" icon="folder-open-outline" colors={colors} onPress={() => void act('docs', { action: 'start_documents', dealId: deal.id })} />
          </View>
        </>
      ) : (
        <>
          {deal.seller ? <DocumentsPanel token={token} clientId={deal.seller.clientId} title={`Sprzedający · ${deal.seller.name}`} colors={colors} /> : null}
          {deal.buyer.kind === 'client' ? (
            <DocumentsPanel token={token} clientId={deal.buyer.clientId} title={`Kupujący · ${deal.buyer.name}`} colors={colors} />
          ) : (
            <Text style={[styles.small, appleType, { color: colors.secondary, marginTop: 8 }]}>
              Kupujący innej agencji — jego dokumenty prowadzi jego agent.
            </Text>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 16, marginBottom: 14 },
  title: { fontSize: 17, fontWeight: '700', letterSpacing: -0.3, marginBottom: 6 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginTop: 16, marginBottom: 6 },
  small: { fontSize: 13, lineHeight: 18 },
  tiny: { fontSize: 11, marginTop: 2 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { paddingHorizontal: 12, minHeight: 34, borderRadius: 99, borderWidth: 1, justifyContent: 'center' },
  chipText: { fontSize: 13 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 38, paddingHorizontal: 13, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  btnPrimary: { backgroundColor: '#34C759', borderColor: '#34C759' },
  btnText: { fontSize: 13, fontWeight: '600' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 10, marginTop: 6 },
  bannerText: { fontSize: 15, fontWeight: '700' },
  offer: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12, marginTop: 8 },
  offerHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  offerWho: { fontSize: 12, fontWeight: '700', width: 84 },
  offerAmount: { flex: 1, fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  offerStatus: { fontSize: 12, fontWeight: '700' },
  box: { borderRadius: 14, padding: 12, marginTop: 10 },
  input: { marginTop: 8, borderRadius: 12, padding: 12, fontSize: 15, minHeight: 64, textAlignVertical: 'top' },
  inputSingle: { minHeight: 44 },
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  field: { flexGrow: 1, flexBasis: 160, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 12 },
  fieldLabel: { fontSize: 11 },
  fieldValue: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  step: { borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 10 },
  stepIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepTitle: { fontSize: 15, fontWeight: '700' },
  phaseHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  phaseNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  phaseNumText: { fontSize: 13, fontWeight: '700' },
  histRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  histAmount: { flex: 1, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 6 },
});

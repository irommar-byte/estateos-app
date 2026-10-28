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

export function NegotiationSection({
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
  const started = Boolean(neg.startedAt || neg.offers.length || neg.financing);
  const closed = deal.status === 'LOST';
  const [by, setBy] = useState<'buyer' | 'seller'>('buyer');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState('');
  const [recommendationKind, setRecommendationKind] = useState<'accept' | 'counter' | 'reject' | null>(null);
  const [financing, setFinancing] = useState(neg.financing || { kind: 'cash' as const, bank: '', decision: 'none' as const });
  const [deposit, setDeposit] = useState(neg.terms?.deposit ? String(neg.terms.deposit) : '');
  const [terms, setTerms] = useState({
    preliminaryAt: neg.terms?.preliminaryAt || null,
    deedAt: neg.terms?.deedAt || null,
    handoverAt: neg.terms?.handoverAt || null,
  });

  useEffect(() => {
    setFinancing(neg.financing || { kind: 'cash', bank: '', decision: 'none' });
    setDeposit(neg.terms?.deposit ? String(neg.terms.deposit) : '');
    setTerms({ preliminaryAt: neg.terms?.preliminaryAt || null, deedAt: neg.terms?.deedAt || null, handoverAt: neg.terms?.handoverAt || null });
  }, [deal.updatedAt]);

  if (!started) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.title, appleType, { color: colors.text }]}>3 · Negocjacje</Text>
        <Text style={[styles.small, appleType, { color: colors.secondary }]}>
          Propozycje ceny i kontroferty, finansowanie, zadatek, terminy i rezerwacja.
        </Text>
        {!closed ? (
          <View style={styles.row}>
            <Btn
              label="Klient kupuje — przejdź do negocjacji"
              icon="cash-outline"
              primary
              colors={colors}
              onPress={() =>
                Alert.alert(
                  'Przejść do negocjacji?',
                  deal.presentation?.heldAt ? 'Kupujący chce kupić — zapiszemy propozycję ceny i warunki.' : 'Prezentację i opinię oznaczymy jako pominięte.',
                  [
                    { text: 'Anuluj', style: 'cancel' },
                    { text: 'Przejdź', onPress: () => void act('neg', { action: 'start_negotiation', dealId: deal.id }) },
                  ],
                )
              }
            />
          </View>
        ) : null}
      </View>
    );
  }

  const saveOffer = async () => {
    const value = parseAmount(amount);
    if (!value) {
      Alert.alert('Propozycja', 'Podaj kwotę.');
      return;
    }
    const res = await act('offer', { action: 'add_offer', dealId: deal.id, by, amount: value, note: note.trim() || undefined });
    if (res.ok) {
      setAmount('');
      setNote('');
    }
  };

  const decide = (offer: NegotiationOffer, status: 'accepted' | 'rejected') =>
    Alert.alert(status === 'accepted' ? 'Cena uzgodniona?' : 'Odrzucić propozycję?', formatPln(offer.amount), [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: status === 'accepted' ? 'Uzgodnione' : 'Odrzuć',
        style: status === 'accepted' ? 'default' : 'destructive',
        onPress: () => void act(`st-${offer.id}`, { action: 'set_offer_status', dealId: deal.id, offerId: offer.id, status }),
      },
    ]);

  const forwardToBuyer = (offer: NegotiationOffer) => {
    const draft = `sprzedający proponuje ${formatPln(offer.amount)}${offer.note ? ` (${offer.note})` : ''}. Daj znać, czy to dla Ciebie do przyjęcia — porozmawiamy o szczegółach.`;
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Wiadomość do kupującego',
        'Przed wysłaniem zobaczysz podgląd do akceptacji.',
        (text) => text?.trim() && void act(`buyer-${offer.id}`, { action: 'message_buyer', dealId: deal.id, message: text.trim(), offerId: offer.id }),
        'plain-text',
        draft,
      );
    } else {
      void act(`buyer-${offer.id}`, { action: 'message_buyer', dealId: deal.id, message: draft, offerId: offer.id });
    }
  };

  const setReservation = () =>
    pickDate('Rezerwacja do', neg.reservation?.until, async (iso) => {
      const res = await act('res', { action: 'set_reservation', dealId: deal.id, until: iso });
      if (res.ok && res.otherActive) askAboutOthers(res.otherActive);
    });

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, appleType, { color: colors.text }]}>3 · Negocjacje</Text>
      {neg.skippedPresentation ? (
        <Text style={[styles.small, appleType, { color: colors.secondary }]}>Bez prezentacji — klient od razu kupuje.</Text>
      ) : null}
      {neg.agreedPrice ? (
        <View style={[styles.banner, { backgroundColor: 'rgba(52,199,89,0.12)' }]}>
          <Ionicons name="checkmark-circle" size={18} color="#34C759" />
          <Text style={[styles.bannerText, appleType, { color: colors.text }]}>Cena uzgodniona: {formatPln(neg.agreedPrice)}</Text>
        </View>
      ) : null}

      <Text style={[styles.kicker, appleType, { color: colors.secondary }]}>PROPOZYCJE CENY</Text>
      {neg.offers.length ? (
        neg.offers.map((offer) => {
          const st = OFFER_STATUS[offer.status];
          const open = offer.status === 'open' && !closed;
          return (
            <View key={offer.id} style={[styles.offer, { borderColor: colors.border }]}>
              <View style={styles.offerHead}>
                <Text style={[styles.offerWho, appleType, { color: offer.by === 'buyer' ? '#C25E00' : '#1F8A44' }]}>
                  {offer.by === 'buyer' ? 'Kupujący' : 'Sprzedający'}
                </Text>
                <Text style={[styles.offerAmount, appleType, { color: colors.text }]}>{formatPln(offer.amount)}</Text>
                <Text style={[styles.offerStatus, appleType, { color: st.color }]}>{st.label}</Text>
              </View>
              {offer.note ? <Text style={[styles.small, appleType, { color: colors.text }]}>{offer.note}</Text> : null}
              <Text style={[styles.tiny, appleType, { color: colors.secondary }]}>
                {formatDealWhen(offer.at)}
                {offer.sentToSellerAt ? ` · przekazano sprzedającemu ${formatDealWhen(offer.sentToSellerAt)}` : ''}
                {offer.sentToBuyerAt ? ` · przekazano kupującemu ${formatDealWhen(offer.sentToBuyerAt)}` : ''}
              </Text>
              {open ? (
                <View style={styles.row}>
                  {offer.by === 'buyer' && deal.seller && !offer.sentToSellerAt ? (
                    <Btn label="Przekaż sprzedającemu" icon="arrow-redo-outline" colors={colors} onPress={() => setSendingId(offer.id)} />
                  ) : null}
                  {offer.by === 'seller' && deal.buyer.kind === 'client' && !offer.sentToBuyerAt ? (
                    <Btn label="Przekaż kupującemu" icon="arrow-redo-outline" colors={colors} onPress={() => forwardToBuyer(offer)} />
                  ) : null}
                  <Btn label="Uzgodnione" icon="checkmark" colors={colors} onPress={() => decide(offer, 'accepted')} />
                  <Btn label="Odrzuć" danger colors={colors} onPress={() => decide(offer, 'rejected')} />
                </View>
              ) : null}
              {sendingId === offer.id ? (
                <View style={{ marginTop: 8 }}>
                  <Text style={[styles.small, appleType, { color: colors.secondary }]}>
                    Sprzedający zobaczy ją w panelu jako „Kupujący N” — bez danych kupującego. Twoja rekomendacja (opcjonalnie):
                  </Text>
                  <View style={styles.row}>
                    {(
                      [
                        ['accept', 'Przyjąć'],
                        ['counter', 'Kontroferta'],
                        ['reject', 'Odrzucić'],
                      ] as const
                    ).map(([key, label]) => (
                      <Chip key={key} label={label} active={recommendationKind === key} colors={colors} onPress={() => setRecommendationKind(recommendationKind === key ? null : key)} />
                    ))}
                  </View>
                  <TextInput
                    value={recommendation}
                    onChangeText={setRecommendation}
                    placeholder="Dlaczego tak radzisz (opcjonalnie)"
                    placeholderTextColor={colors.secondary}
                    multiline
                    style={[styles.input, { color: colors.text, backgroundColor: colors.input }]}
                  />
                  <View style={styles.row}>
                    <Btn
                      label="Dalej do podglądu"
                      primary
                      colors={colors}
                      onPress={async () => {
                        const res = await act(`send-${offer.id}`, {
                          action: 'send_offer_to_seller',
                          dealId: deal.id,
                          offerId: offer.id,
                          recommendation: recommendation.trim() || undefined,
                          recommendationKind: recommendationKind || undefined,
                        });
                        if (res.ok) {
                          setSendingId(null);
                          setRecommendation('');
                          setRecommendationKind(null);
                        }
                      }}
                    />
                    <Btn label="Anuluj" colors={colors} onPress={() => setSendingId(null)} />
                  </View>
                </View>
              ) : null}
            </View>
          );
        })
      ) : (
        <Text style={[styles.small, appleType, { color: colors.secondary }]}>Brak propozycji — zapisz pierwszą poniżej.</Text>
      )}

      {!closed ? (
        <View style={[styles.box, { backgroundColor: colors.input }]}>
          <View style={styles.row}>
            <Chip label="Kupujący proponuje" active={by === 'buyer'} colors={colors} onPress={() => setBy('buyer')} />
            <Chip label="Sprzedający chce" active={by === 'seller'} colors={colors} onPress={() => setBy('seller')} />
          </View>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="Kwota, np. 520 000"
            placeholderTextColor={colors.secondary}
            keyboardType="number-pad"
            style={[styles.input, styles.inputSingle, { color: colors.text, backgroundColor: colors.card }]}
          />
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Uwagi (opcjonalnie): warunki, termin wydania…"
            placeholderTextColor={colors.secondary}
            style={[styles.input, styles.inputSingle, { color: colors.text, backgroundColor: colors.card }]}
          />
          <View style={styles.row}>
            <Btn label="Zapisz propozycję" icon="add" primary colors={colors} disabled={!amount.trim()} onPress={() => void saveOffer()} />
          </View>
        </View>
      ) : null}

      <Text style={[styles.kicker, appleType, { color: colors.secondary }]}>FINANSOWANIE</Text>
      <View style={styles.row}>
        {(
          [
            ['cash', 'Gotówka'],
            ['mortgage', 'Kredyt'],
            ['mixed', 'Gotówka + kredyt'],
          ] as const
        ).map(([key, label]) => (
          <Chip key={key} label={label} active={financing.kind === key} colors={colors} onPress={() => setFinancing({ ...financing, kind: key })} />
        ))}
      </View>
      {financing.kind !== 'cash' ? (
        <>
          <TextInput
            value={financing.bank || ''}
            onChangeText={(bank) => setFinancing({ ...financing, bank })}
            placeholder="Bank (opcjonalnie)"
            placeholderTextColor={colors.secondary}
            style={[styles.input, styles.inputSingle, { color: colors.text, backgroundColor: colors.input }]}
          />
          <View style={styles.row}>
            {(
              [
                ['none', 'Brak wniosku'],
                ['pending', 'Decyzja w toku'],
                ['approved', 'Pozytywna'],
                ['rejected', 'Odmowa'],
              ] as const
            ).map(([key, label]) => (
              <Chip key={key} label={label} active={(financing.decision || 'none') === key} colors={colors} onPress={() => setFinancing({ ...financing, decision: key })} />
            ))}
          </View>
        </>
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
          <Btn
            label="Zapisz finansowanie i terminy"
            primary
            colors={colors}
            onPress={() =>
              void act('terms', {
                action: 'set_negotiation',
                dealId: deal.id,
                financing: { kind: financing.kind, bank: financing.bank || undefined, decision: financing.decision || 'none' },
                terms: { deposit: parseAmount(deposit), ...terms },
              })
            }
          />
        </View>
      ) : null}

      <Text style={[styles.kicker, appleType, { color: colors.secondary }]}>REZERWACJA</Text>
      {neg.reservation ? (
        <Text style={[styles.small, appleType, { color: colors.text }]}>
          Zarezerwowane do {formatDealWhen(neg.reservation.until)}
          {neg.othersDecision === 'paused' ? ' · pozostali kupujący wstrzymani' : neg.othersDecision === 'backup' ? ' · pozostali jako rezerwowi' : ''}
        </Text>
      ) : (
        <Text style={[styles.small, appleType, { color: colors.secondary }]}>Brak rezerwacji.</Text>
      )}
      {!closed ? (
        <View style={styles.row}>
          <Btn label={neg.reservation ? 'Zmień datę' : 'Zarezerwuj dla tego kupującego'} icon="lock-closed-outline" colors={colors} onPress={setReservation} />
          {neg.reservation ? <Btn label="Zdejmij rezerwację" danger colors={colors} onPress={() => void act('res', { action: 'set_reservation', dealId: deal.id, until: null })} /> : null}
        </View>
      ) : null}
    </View>
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
  const reached = Boolean(deal.negotiation.agreedPrice || deal.negotiation.reservation || Object.values(deal.transaction).some((v) => typeof v === 'object' && v));
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, appleType, { color: colors.text }]}>4 · Transakcja</Text>
      {!reached ? (
        <Text style={[styles.small, appleType, { color: colors.secondary, marginBottom: 6 }]}>
          Zwykle po uzgodnieniu ceny — ale możesz zacząć od dowolnego kroku.
        </Text>
      ) : null}
      {STEPS.map((step) => (
        <StepCard key={step.id} step={step} {...props} />
      ))}
    </View>
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
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.title, appleType, { color: colors.text }]}>Dokumenty do transakcji</Text>
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
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 6 },
});

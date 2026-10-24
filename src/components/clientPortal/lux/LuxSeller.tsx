import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import LuxSheet from './LuxSheet';
import { LuxButton, LuxCard, LuxField, LuxKicker, LuxTitle } from './LuxUI';
import { luxAction } from './luxApi';
import { LUX_SERIF, plnFormat, type LuxPalette } from './luxTheme';
import type { LuxBuyerOffer, LuxSeller } from './types';

const FINANCING: Record<string, string> = { cash: 'Gotówka', mortgage: 'Kredyt', mixed: 'Gotówka + kredyt' };

export function LuxSellerStats({ stats }: { stats: LuxSeller['stats'] }) {
  if (!stats) return null;
  const tiles: Array<[string, number]> = [
    ['Wyświetlenia', stats.views],
    ['Dopasowani kupujący', stats.matches],
    ['Oglądania', stats.showings],
    ['Oferty', stats.buyerOffers],
  ];
  return (
    <View style={styles.tiles}>
      {tiles.map(([label, value]) => (
        <View key={label} style={styles.tile}>
          <Text style={{ fontFamily: LUX_SERIF, fontSize: 26, color: '#F6F3EE' }}>{value.toLocaleString('pl-PL')}</Text>
          <Text style={{ color: '#8C877D', fontSize: 11, marginTop: 2, fontWeight: '700' }}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

function BuyerOfferCard({ offer, listPrice, token, palette, agentFirst, onChanged }: { offer: LuxBuyerOffer; listPrice: number; token: string; palette: LuxPalette; agentFirst: string; onChanged: () => void }) {
  const [counter, setCounter] = useState('');
  const [counterOpen, setCounterOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const diff = listPrice ? Math.round(((offer.amount - listPrice) / listPrice) * 1000) / 10 : null;
  const respond = async (response: 'accept' | 'counter' | 'reject') => {
    setBusy(response);
    try {
      await luxAction(token, 'respond_buyer_offer', {
        buyerOfferId: offer.id,
        response,
        counterAmount: response === 'counter' ? Number(counter.replace(/\D/g, '')) : null,
      });
      onChanged();
    } catch (e) {
      Alert.alert('Oferta', e instanceof Error ? e.message : 'Nie udało się.');
    } finally {
      setBusy(null);
    }
  };
  const answered = offer.clientResponse;
  return (
    <LuxCard palette={palette}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <LuxKicker palette={palette}>Oferta kupującego</LuxKicker>
          <Text style={{ fontFamily: LUX_SERIF, fontSize: 30, color: palette.ink, marginTop: 4 }}>{plnFormat(offer.amount)}</Text>
          <Text style={{ fontSize: 13, color: palette.muted, marginTop: 2 }}>
            {offer.buyerLabel} · {FINANCING[offer.financing] || offer.financing}
            {diff != null ? ` · ${diff > 0 ? '+' : ''}${diff}% od ceny` : ''}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 12 }}>
        {offer.deposit ? <Text style={{ color: palette.ink, fontSize: 13 }}>Zadatek: {plnFormat(offer.deposit)}</Text> : null}
        {offer.deedWeeks ? <Text style={{ color: palette.ink, fontSize: 13 }}>Akt: do {offer.deedWeeks} tyg.</Text> : null}
        {offer.handoverDays ? <Text style={{ color: palette.ink, fontSize: 13 }}>Wydanie: {offer.handoverDays} dni</Text> : null}
      </View>
      {offer.recommendation ? (
        <View style={[styles.reco, { backgroundColor: palette.cardAlt }]}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: palette.accent }}>
            Rekomendacja {agentFirst}
            {offer.recommendationKind ? ` · ${offer.recommendationKind === 'accept' ? 'przyjąć' : offer.recommendationKind === 'counter' ? 'kontrpropozycja' : 'odrzucić'}` : ''}
          </Text>
          <Text style={{ fontSize: 14, color: palette.ink, marginTop: 4, lineHeight: 20 }}>{offer.recommendation}</Text>
        </View>
      ) : null}
      {offer.status !== 'OPEN' || answered ? (
        <Text style={{ marginTop: 12, fontWeight: '800', color: palette.good }}>
          {answered === 'accept' ? 'Przyjęta — agent prowadzi dalej' : answered === 'counter' ? `Wysłano kontrę: ${plnFormat(offer.counterAmount)}` : answered === 'reject' ? 'Odrzucona' : 'Zamknięta'}
        </Text>
      ) : (
        <>
          {counterOpen ? <LuxField palette={palette} label="Twoja kwota" value={counter} onChangeText={setCounter} suffix="zł" keyboardType="number-pad" /> : null}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <LuxButton palette={palette} variant="primary" label="Przyjmij" onPress={() => void respond('accept')} busy={busy === 'accept'} style={{ flex: 1 }} />
            <LuxButton
              palette={palette}
              label={counterOpen ? 'Wyślij' : 'Kontra'}
              onPress={() => (counterOpen ? void respond('counter') : setCounterOpen(true))}
              busy={busy === 'counter'}
              disabled={counterOpen && !counter}
              style={{ flex: 1 }}
            />
            <LuxButton palette={palette} variant="ghost" label="Odrzuć" onPress={() => void respond('reject')} busy={busy === 'reject'} style={{ flex: 1 }} />
          </View>
        </>
      )}
    </LuxCard>
  );
}

export function LuxBuyerOffers(props: { seller: LuxSeller; listPrice: number; token: string; palette: LuxPalette; agentFirst: string; onChanged: () => void }) {
  if (!props.seller.buyerOffers.length) return null;
  return (
    <View>
      {props.seller.buyerOffers.map((o) => (
        <BuyerOfferCard key={o.id} offer={o} listPrice={props.listPrice} token={props.token} palette={props.palette} agentFirst={props.agentFirst} onChanged={props.onChanged} />
      ))}
    </View>
  );
}

export function LuxShowingFeedback({ seller, palette, agentFirst, recommendation }: { seller: LuxSeller; palette: LuxPalette; agentFirst: string; recommendation?: string | null }) {
  const fb = seller.showingFeedback;
  if (!fb || !fb.items.length) return null;
  const max = Math.max(...fb.items.map((i) => i.count), 1);
  return (
    <LuxCard palette={palette}>
      <LuxKicker palette={palette}>Opinie z oglądań</LuxKicker>
      <LuxTitle palette={palette}>Co mówią kupujący · {fb.showings}</LuxTitle>
      {fb.items.slice(0, 6).map((i) => (
        <View key={i.tag} style={{ marginTop: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: palette.ink, fontSize: 14 }}>{i.tag}</Text>
            <Text style={{ color: palette.muted, fontSize: 13 }}>×{i.count}</Text>
          </View>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: palette.cardAlt, marginTop: 4 }}>
            <View style={{ width: `${(i.count / max) * 100}%`, height: 6, borderRadius: 3, backgroundColor: i.negative ? palette.bad : palette.good }} />
          </View>
        </View>
      ))}
      {recommendation ? (
        <View style={[styles.reco, { backgroundColor: palette.cardAlt }]}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: palette.accent }}>Co proponuje {agentFirst}</Text>
          <Text style={{ fontSize: 14, color: palette.ink, marginTop: 4, lineHeight: 20 }}>{recommendation}</Text>
        </View>
      ) : null}
    </LuxCard>
  );
}

export function LuxCompetition({ seller, palette }: { seller: LuxSeller; palette: LuxPalette }) {
  const c = seller.competition;
  if (!c) return null;
  const rows: Array<[string, string]> = [
    ['Twoja cena za m²', c.ownPpsm ? `${c.ownPpsm.toLocaleString('pl-PL')} zł` : '—'],
    [`Podobne w okolicy (${c.similarCount})`, c.similarPpsm ? `${c.similarPpsm.toLocaleString('pl-PL')} zł` : '—'],
    ['Transakcje w okolicy', c.transactionPpsm ? `${c.transactionPpsm.toLocaleString('pl-PL')} zł` : '—'],
    ['Dni na rynku', `${c.ownDays}${c.similarDays ? ` (średnio ${c.similarDays})` : ''}`],
  ];
  return (
    <LuxCard palette={palette}>
      <LuxKicker palette={palette}>Konkurencja</LuxKicker>
      <LuxTitle palette={palette}>Na tle okolicy</LuxTitle>
      {rows.map(([l, v]) => (
        <View key={l} style={[styles.compRow, { borderTopColor: palette.border }]}>
          <Text style={{ color: palette.muted, fontSize: 14 }}>{l}</Text>
          <Text style={{ color: palette.ink, fontSize: 15, fontWeight: '800' }}>{v}</Text>
        </View>
      ))}
    </LuxCard>
  );
}

/** Ile zostanie na rękę: cena − prowizja − podatek − kredyt − inne. */
export function LuxNetSheet({ open, onClose, seller, defaultPrice, token, palette, onSaved }: { open: boolean; onClose: () => void; seller: LuxSeller; defaultPrice: number; token: string; palette: LuxPalette; onSaved: () => void }) {
  const offersPrices = seller.buyerOffers.filter((o) => o.status === 'OPEN').map((o) => o.amount);
  const [price, setPrice] = useState(String(offersPrices[0] || defaultPrice || ''));
  const [mortgage, setMortgage] = useState(String(seller.finance.mortgageBalance ?? ''));
  const [year, setYear] = useState(String(seller.finance.purchaseYear ?? ''));
  const [purchase, setPurchase] = useState(String(seller.finance.purchasePrice ?? ''));
  const [save, setSave] = useState(true);
  const n = (v: string) => Number(v.replace(/\s/g, '')) || 0;

  const calc = useMemo(() => {
    const p = n(price);
    const pct = seller.finance.commissionPct ?? 0;
    const commissionNet = Math.round((p * pct) / 100);
    const commission = seller.finance.commissionVat ? Math.round(commissionNet * 1.23) : commissionNet;
    const other = Math.round(seller.finance.otherCosts ?? 300);
    let tax = 0;
    let taxNote = 'Podaj rok zakupu, żeby policzyć podatek.';
    const y = n(year);
    if (y) {
      const free = y + 6;
      if (new Date().getFullYear() >= free) taxNote = 'Podatek 0 zł — minęło 5 lat od końca roku nabycia.';
      else if (n(purchase)) {
        tax = Math.round(Math.max(0, p - n(purchase) - commission - other) * 0.19);
        taxNote = `19% od dochodu (sprzedaż przed ${free} r.). Ulga mieszkaniowa może go obniżyć do zera.`;
      } else taxNote = `Sprzedaż przed ${free} r. — podaj cenę zakupu.`;
    }
    return { p, commission, pct, tax, taxNote, other, mortgage: n(mortgage), net: p - n(mortgage) - commission - tax - other };
  }, [price, mortgage, year, purchase, seller.finance]);

  const close = () => {
    if (save) {
      void luxAction(token, 'save_seller_finance', { finance: { mortgageBalance: n(mortgage) || null, purchaseYear: n(year) || null, purchasePrice: n(purchase) || null } })
        .then(onSaved)
        .catch(() => null);
    }
    onClose();
  };

  const line = (l: string, v: number, minus = true) => (
    <View key={l} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ color: '#BDB6AA', fontSize: 14 }}>{l}</Text>
      <Text style={{ color: '#F6F3EE', fontSize: 14, fontWeight: '700' }}>
        {minus && v ? '− ' : ''}
        {plnFormat(v)}
      </Text>
    </View>
  );

  return (
    <LuxSheet open={open} onClose={close} kicker="Kalkulator" title="Ile zostanie na rękę" palette={palette}>
      <LuxField palette={palette} label="Cena sprzedaży" value={price} onChangeText={setPrice} suffix="zł" keyboardType="number-pad" />
      <LuxField palette={palette} label="Pozostały kredyt (jeśli jest)" value={mortgage} onChangeText={setMortgage} suffix="zł" keyboardType="number-pad" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <LuxField palette={palette} label="Rok zakupu" value={year} onChangeText={setYear} keyboardType="number-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <LuxField palette={palette} label="Cena zakupu" value={purchase} onChangeText={setPurchase} suffix="zł" keyboardType="number-pad" />
        </View>
      </View>
      <View style={{ marginTop: 16, borderRadius: 22, backgroundColor: '#000', padding: 18 }}>
        {line('Cena', calc.p, false)}
        {line(`Prowizja ${calc.pct}%`, calc.commission)}
        {line('Spłata kredytu', calc.mortgage)}
        {line('Podatek PIT', calc.tax)}
        {line('Inne koszty', calc.other)}
        <View style={{ height: 1, backgroundColor: 'rgba(216,195,160,0.2)', marginVertical: 10 }} />
        <Text style={{ color: '#D8C3A0', fontSize: 13, fontWeight: '800' }}>Na rękę</Text>
        <Text style={{ fontFamily: LUX_SERIF, color: '#F6F3EE', fontSize: 36, marginTop: 2 }}>{plnFormat(calc.net)}</Text>
        <Text style={{ color: '#8C877D', fontSize: 12, marginTop: 6, lineHeight: 17 }}>{calc.taxNote}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
        <Text style={{ color: palette.ink, fontSize: 14, flex: 1 }}>Zapamiętaj dane dla agenta</Text>
        <Switch value={save} onValueChange={setSave} />
      </View>
    </LuxSheet>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  tile: { width: '48%', flexGrow: 1, borderRadius: 18, padding: 12, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(216,195,160,0.16)' },
  reco: { borderRadius: 16, padding: 12, marginTop: 14 },
  compRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 4 },
});

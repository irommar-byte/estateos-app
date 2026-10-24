import React, { useEffect, useMemo, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import LuxSheet from './LuxSheet';
import { LuxField } from './LuxUI';
import { LUX_SERIF, plnFormat, type LuxPalette } from './luxTheme';

function notaryFee(value: number): number {
  if (value <= 3000) return 100;
  if (value <= 10000) return 100 + 0.03 * (value - 3000);
  if (value <= 30000) return 310 + 0.02 * (value - 10000);
  if (value <= 60000) return 710 + 0.01 * (value - 30000);
  if (value <= 1000000) return 1010 + 0.004 * (value - 60000);
  if (value <= 2000000) return 4770 + 0.002 * (value - 1000000);
  return Math.min(10000, 6770 + 0.0025 * (value - 2000000));
}
const num = (v: string) => Number(String(v).replace(/\s/g, '').replace(',', '.')) || 0;

/** Rata kredytu i koszty zakupu — wyliczenie orientacyjne (to samo co na www). */
export default function LuxCostSheet({ open, onClose, initialPrice, palette }: { open: boolean; onClose: () => void; initialPrice: number; palette: LuxPalette }) {
  const [price, setPrice] = useState(String(initialPrice || 800000));
  const [ownPct, setOwnPct] = useState('20');
  const [rate, setRate] = useState('7.2');
  const [years, setYears] = useState('25');
  const [commission, setCommission] = useState('2');
  const [primary, setPrimary] = useState(false);

  useEffect(() => {
    if (open && initialPrice) setPrice(String(initialPrice));
  }, [open, initialPrice]);

  const calc = useMemo(() => {
    const p = num(price);
    const own = num(ownPct);
    const loan = Math.max(0, p * (1 - own / 100));
    const r = num(rate) / 100 / 12;
    const n = Math.max(1, num(years) * 12);
    const monthly = r > 0 ? (loan * r) / (1 - Math.pow(1 + r, -n)) : loan / n;
    const pcc = primary ? 0 : p * 0.02;
    const notary = notaryFee(p) * 1.23 + (loan > 0 ? notaryFee(loan) * 0.5 * 1.23 : 0);
    const court = 200 + (loan > 0 ? 200 : 0);
    const agency = p * (num(commission) / 100) * 1.23;
    const extras = pcc + notary + court + agency + 300;
    return { loan, monthly, pcc, notary, court, agency, extras, cash: p * (own / 100) + extras };
  }, [price, ownPct, rate, years, commission, primary]);

  const line = (label: string, value: number) => (
    <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
      <Text style={{ color: '#BDB6AA', fontSize: 14 }}>{label}</Text>
      <Text style={{ color: '#F6F3EE', fontSize: 14, fontWeight: '700' }}>{plnFormat(value)}</Text>
    </View>
  );

  return (
    <LuxSheet open={open} onClose={onClose} kicker="Narzędzie" title="Rata i koszty zakupu" palette={palette}>
      <LuxField palette={palette} label="Cena nieruchomości" value={price} onChangeText={setPrice} suffix="zł" keyboardType="number-pad" />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <LuxField palette={palette} label="Wkład własny" value={ownPct} onChangeText={setOwnPct} suffix="%" keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <LuxField palette={palette} label="Oprocentowanie" value={rate} onChangeText={setRate} suffix="%" keyboardType="decimal-pad" />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <LuxField palette={palette} label="Okres kredytu" value={years} onChangeText={setYears} suffix="lat" keyboardType="number-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <LuxField palette={palette} label="Prowizja biura" value={commission} onChangeText={setCommission} suffix="%" keyboardType="decimal-pad" />
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
        <Text style={{ color: palette.ink, fontSize: 14 }}>Rynek pierwotny (bez podatku PCC)</Text>
        <Switch value={primary} onValueChange={setPrimary} />
      </View>
      <View style={{ marginTop: 16, borderRadius: 22, backgroundColor: '#000', padding: 18 }}>
        <Text style={{ color: '#D8C3A0', fontSize: 13, fontWeight: '800' }}>Rata miesięczna</Text>
        <Text style={{ fontFamily: LUX_SERIF, color: '#F6F3EE', fontSize: 36, marginTop: 4 }}>{plnFormat(calc.monthly)}</Text>
        <Text style={{ color: '#8C877D', fontSize: 12, marginTop: 2 }}>Kredyt {plnFormat(calc.loan)}</Text>
        <View style={{ height: 1, backgroundColor: 'rgba(216,195,160,0.2)', marginVertical: 12 }} />
        {line('Podatek PCC 2%', calc.pcc)}
        {line('Notariusz (z VAT)', calc.notary)}
        {line('Opłaty sądowe', calc.court)}
        {line('Prowizja biura (z VAT)', calc.agency)}
        {line('Koszty dodatkowe razem', calc.extras)}
        <View style={{ height: 1, backgroundColor: 'rgba(216,195,160,0.2)', marginVertical: 8 }} />
        {line('Potrzebna gotówka na start', calc.cash)}
      </View>
      <Text style={{ fontSize: 12, color: palette.muted, marginTop: 10, lineHeight: 17 }}>Wyliczenie orientacyjne. Dokładne koszty potwierdzi notariusz i bank.</Text>
    </LuxSheet>
  );
}

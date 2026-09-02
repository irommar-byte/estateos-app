import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import {
  fetchMarketReportQuota,
  fetchMarketValuation,
  formatPln,
  formatPpsm,
  generateMarketReport,
  sendMarketReport,
  type MarketReportQuota,
  type ValuationResult,
} from '../../services/marketService';
import { getSafeWebView } from '../messaging/safeWebView';

type Props = {
  token: string | null;
  lat?: number | null;
  lng?: number | null;
  area?: number | null;
  rooms?: number | null;
  floor?: number | null;
  city?: string | null;
  district?: string | null;
  address?: string | null;
  listingPrice?: number | null;
  purpose?: 'crm' | 'listing' | 'consumer' | 'hub';
  colors: { card: string; text: string; secondary: string; border: string; accent: string };
  onApply?: (price: number) => void;
  reportEmail?: string | null;
  clientId?: number | null;
};

export default function MarketValuationCard({
  token,
  lat,
  lng,
  area,
  rooms,
  floor,
  city,
  district,
  address,
  listingPrice,
  purpose = 'crm',
  colors,
  onApply,
  reportEmail,
  clientId,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ValuationResult | null>(null);
  const [reportMsg, setReportMsg] = useState('');
  const [email, setEmail] = useState(reportEmail || '');
  const [alternateEmail, setAlternateEmail] = useState('');
  const [quota, setQuota] = useState<MarketReportQuota | null>(null);
  const [busy, setBusy] = useState(false);
  const [reportId, setReportId] = useState<number | null>(null);
  const [htmlClassic, setHtmlClassic] = useState('');
  const [htmlPro, setHtmlPro] = useState('');
  const [previewVariant, setPreviewVariant] = useState<'classic' | 'pro' | null>(null);

  useEffect(() => {
    setEmail(reportEmail || '');
  }, [reportEmail]);

  useEffect(() => {
    void fetchMarketReportQuota(token).then((q) => {
      if (q) setQuota(q);
    });
  }, [token]);

  useEffect(() => {
    if (lat == null || lng == null || !area) {
      setResult(null);
      setError('Uzupełnij adres na mapie i powierzchnię.');
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      setLoading(true);
      setError(null);
      void fetchMarketValuation(token, {
        lat, lng, area, rooms, floor, city, district, address, listingPrice, purpose,
      }).then((json) => {
        if (cancelled) return;
        if (!json.ok) {
          setResult(null);
          setError(json.message);
        } else {
          setResult(json);
          if (json.access?.quota) setQuota(json.access.quota);
        }
      }).finally(() => {
        if (!cancelled) setLoading(false);
      });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [token, lat, lng, area, rooms, floor, city, district, address, listingPrice, purpose]);

  const payload = {
    lat, lng, area, rooms, floor, city, district, address, listingPrice,
    email,
    alternateEmail,
    clientId: clientId || undefined,
  };

  const destLabel = [email.trim(), alternateEmail.trim()].filter(Boolean).join(', ');
  const propertyLabel = [address, district, city].filter(Boolean).join(', ') || 'tej nieruchomości';
  const propertyMeta = [area ? `${area} m²` : null, rooms ? `${rooms} pok.` : null].filter(Boolean).join(' · ');

  const sendExisting = (id: number, variant: 'classic' | 'pro') => {
    if (!destLabel) {
      setReportMsg('Wpisz e-mail, żeby wysłać. Wysyłka nie zużyje kolejnego punktu.');
      return;
    }
    setBusy(true);
    void sendMarketReport(token, { ...payload, reportId: id, variant }).then((sent) => {
      setBusy(false);
      if (sent.json?.quota) setQuota(sent.json.quota);
      setPreviewVariant(null);
      setReportMsg(
        sent.ok
          ? `Wysłano ${variant === 'pro' ? 'wersję z mapą' : 'wersję dotychczasową'} na ${destLabel}.${sent.json?.clientRecorded ? ' Zapisano w panelu klienta.' : ''} Limit się nie zmienił.`
          : String(sent.json?.message || 'Nie wysłano raportu.'),
      );
    });
  };

  const doGenerate = () => {
    setBusy(true);
    void generateMarketReport(token, payload).then((r) => {
      setBusy(false);
      if (!r.ok) {
        setReportMsg(String(r.json?.message || 'Nie wygenerowano raportu.'));
        if (r.json?.quota) setQuota(r.json.quota);
        return;
      }
      if (r.json?.quota) setQuota(r.json.quota);
      const id = Number(r.json?.reportId);
      const storedId = Number.isFinite(id) && id > 0 ? id : null;
      setReportId(storedId);
      setHtmlClassic(String(r.json?.html || ''));
      setHtmlPro(String(r.json?.htmlPro || r.json?.html || ''));
      setReportMsg('Wygenerowano dwie wersje — 1 punkt z limitu. Wybierz, którą wysłać. Wysyłka nic więcej nie zdejmie.');
      if (!storedId) return;
    });
  };

  const startReport = () => {
    if (!result) return;
    if (quota && quota.remaining <= 0) {
      setReportMsg(quota.message);
      return;
    }
    const remainingHint =
      quota && quota.cap != null
        ? `\nZostanie ${Math.max(0, quota.remaining - 1)} z ${quota.cap}.`
        : quota?.kind === 'credits'
          ? `\nZostanie ${Math.max(0, quota.remaining - 1)} ${quota.remaining - 1 === 1 ? 'kredyt' : 'kredytów'}.`
          : '';
    Alert.alert(
      'Wygenerować raport?',
      `Czy chcesz wygenerować raport dla:\n${propertyLabel}${propertyMeta ? `\n${propertyMeta}` : ''}\n\nTo zużyje 1 punkt z limitu.${remainingHint}\nWysyłka e-mail później nic już nie zdejmie.`,
      [
        { text: 'Nie', style: 'cancel' },
        { text: 'Tak, wygeneruj', onPress: doGenerate },
      ],
    );
  };

  return (
    <>
    <View style={{ borderRadius: 18, borderWidth: 1, borderColor: 'rgba(52,199,89,0.28)', backgroundColor: colors.card, overflow: 'hidden', marginBottom: 14 }}>
      <View style={{ paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Text style={{ color: colors.accent, fontWeight: '900', fontSize: 10, letterSpacing: 1.2 }}>ESTATEOS™ MARKET</Text>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13, marginTop: 3 }}>Rzeczywiste ceny transakcyjne (RCN)</Text>
      </View>
      <View style={{ padding: 14, gap: 10 }}>
        {loading ? <ActivityIndicator color={colors.accent} /> : null}
        {error ? <Text style={{ color: '#F59E0B', fontSize: 13, lineHeight: 18 }}>{error}</Text> : null}
        {result ? (
          <>
            <Text style={{ color: colors.text, fontSize: 26, fontWeight: '900' }}>{formatPln(result.estimated.mid)}</Text>
            <Text style={{ color: colors.secondary, fontSize: 13 }}>
              {formatPln(result.estimated.low)} – {formatPln(result.estimated.high)} · {formatPpsm(result.estimated.ppsm)}
            </Text>
            <Text style={{ color: colors.secondary, fontSize: 12 }}>
              {result.stats.count} aktów · {result.stats.windowMonths} mies.
              {result.stats.basis === 'comps' ? ` · ${result.stats.radiusM} m` : ''}
            </Text>
            {result.vsListing ? (
              <View style={{ borderRadius: 14, padding: 12, backgroundColor: 'rgba(52,199,89,0.1)' }}>
                <Text style={{ color: colors.accent, fontWeight: '900', fontSize: 12 }}>PRICE SCORE {result.vsListing.score}/100</Text>
                <Text style={{ color: colors.text, fontWeight: '800', marginTop: 4 }}>{result.vsListing.label}</Text>
                <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 4, lineHeight: 17 }}>{result.vsListing.detail}</Text>
              </View>
            ) : null}
            {result.comps.slice(0, 6).map((c) => (
              <View key={c.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }} numberOfLines={1}>{c.address || c.district || 'Okolica'}</Text>
                  <Text style={{ color: colors.secondary, fontSize: 11 }}>
                    {[c.area ? `${c.area} m²` : null, c.rooms ? `${c.rooms} pok.` : null, c.deedAt].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Text style={{ color: colors.text, fontWeight: '800' }}>{formatPpsm(c.ppsm)}</Text>
              </View>
            ))}
            {onApply ? (
              <Pressable onPress={() => onApply(result.estimated.recommendedAsk)}>
                <Text style={{ color: '#007AFF', fontWeight: '800', fontSize: 13 }}>Zastosuj cenę rekomendowaną · {formatPln(result.estimated.recommendedAsk)}</Text>
              </Pressable>
            ) : null}
            {quota ? (
              <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 12 }}>
                {quota.cap != null ? `Wygenerowania: ${quota.remaining} / ${quota.cap} (${quota.windowLabel})` : quota.message}
              </Text>
            ) : null}
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="E-mail klienta"
              placeholderTextColor={colors.secondary}
              autoCapitalize="none"
              keyboardType="email-address"
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                color: colors.text,
                fontSize: 14,
              }}
            />
            <TextInput
              value={alternateEmail}
              onChangeText={setAlternateEmail}
              placeholder="E-mail alternatywny (opcjonalnie)"
              placeholderTextColor={colors.secondary}
              autoCapitalize="none"
              keyboardType="email-address"
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                color: colors.text,
                fontSize: 14,
              }}
            />
            <Pressable onPress={startReport} disabled={busy}>
              <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 13 }}>
                {busy ? 'Generuję…' : reportId ? 'Wygeneruj kolejny raport' : 'Generuj raport dla właściciela'}
              </Text>
            </Pressable>
            {reportId ? (
              <View style={{ gap: 8 }}>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13 }}>
                  Dwie wersje gotowe — wybierz, którą wysłać
                </Text>
                <View style={{ borderWidth: 1, borderColor: colors.accent, borderRadius: 12, padding: 12 }}>
                  <Text style={{ color: colors.text, fontWeight: '800' }}>Dla klienta · mapa i rekomendacja</Text>
                  <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 4, lineHeight: 17 }}>
                    List na właściciela, wyróżniona cena ofertowa i z metra, mapa aktów.
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 14, marginTop: 8 }}>
                    <Pressable onPress={() => setPreviewVariant('pro')}>
                      <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>Podgląd</Text>
                    </Pressable>
                    <Pressable onPress={() => sendExisting(reportId, 'pro')} disabled={busy}>
                      <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 13 }}>Wyślij tę wersję</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12 }}>
                  <Text style={{ color: colors.text, fontWeight: '800' }}>Wersja dotychczasowa</Text>
                  <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 4, lineHeight: 17 }}>
                    Obecny list z tabelą transakcji, bez mapy.
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 14, marginTop: 8 }}>
                    <Pressable onPress={() => setPreviewVariant('classic')}>
                      <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>Podgląd</Text>
                    </Pressable>
                    <Pressable onPress={() => sendExisting(reportId, 'classic')} disabled={busy}>
                      <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 13 }}>Wyślij tę wersję</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ) : null}
            {reportMsg ? <Text style={{ color: colors.secondary, fontSize: 12 }}>{reportMsg}</Text> : null}
            <Text style={{ color: colors.secondary, fontSize: 10, lineHeight: 14 }}>{result.coverage.disclaimer}</Text>
          </>
        ) : null}
      </View>
    </View>
    <ReportPreviewModal
      visible={previewVariant != null}
      html={previewVariant === 'pro' ? htmlPro || htmlClassic : htmlClassic || htmlPro}
      title={previewVariant === 'pro' ? 'Wersja dla klienta' : 'Wersja dotychczasowa'}
      colors={colors}
      onClose={() => setPreviewVariant(null)}
      onSend={() => {
        if (reportId && previewVariant) sendExisting(reportId, previewVariant);
      }}
      busy={busy}
    />
    </>
  );
}

function ReportPreviewModal({
  visible,
  html,
  title,
  colors,
  onClose,
  onSend,
  busy,
}: {
  visible: boolean;
  html: string;
  title: string;
  colors: Props['colors'];
  onClose: () => void;
  onSend: () => void;
  busy: boolean;
}) {
  const WebView = getSafeWebView();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: 54 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10 }}>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={{ color: colors.accent, fontWeight: '800' }}>Zamknij</Text>
          </Pressable>
        </View>
        {WebView && html ? (
          <WebView
            source={{ html } as { uri: string }}
            style={{ flex: 1, backgroundColor: '#fff' }}
            originWhitelist={['*']}
          />
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <Text style={{ color: colors.secondary, lineHeight: 20 }}>
              Podgląd HTML jest dostępny na www. Tu możesz od razu wysłać wybraną wersję.
            </Text>
          </ScrollView>
        )}
        <Pressable
          onPress={onSend}
          disabled={busy}
          style={{ margin: 16, backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
        >
          <Text style={{ color: '#000', fontWeight: '900' }}>{busy ? 'Wysyłam…' : 'Wyślij tę wersję'}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

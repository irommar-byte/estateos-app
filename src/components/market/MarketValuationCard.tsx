import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import {
  fetchMarketReportPreview,
  fetchMarketReportQuota,
  fetchMarketValuation,
  fetchOfferMarketReports,
  formatPln,
  formatPpsm,
  generateMarketReport,
  sendMarketReport,
  type MarketReportQuota,
  type StoredOfferReport,
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
  colors: { card: string; text: string; secondary: string; border: string; accent: string; bg?: string };
  onApply?: (price: number) => void;
  onResultChange?: (result: ValuationResult | null) => void;
  reportEmail?: string | null;
  clientId?: number | null;
  offerId?: number | null;
  compact?: boolean;
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
  onResultChange,
  reportEmail,
  clientId,
  offerId,
  compact = false,
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
  const [savedReports, setSavedReports] = useState<StoredOfferReport[]>([]);
  const [sentClassic, setSentClassic] = useState(false);
  const [sentPro, setSentPro] = useState(false);

  useEffect(() => {
    setEmail(reportEmail || '');
  }, [reportEmail]);

  useEffect(() => {
    void fetchMarketReportQuota(token).then((q) => {
      if (q) setQuota(q);
    });
  }, [token]);

  useEffect(() => {
    if (!clientId || !offerId) return;
    let cancelled = false;
    void fetchOfferMarketReports(token, { clientId, offerId }).then((loaded) => {
      if (cancelled) return;
      if (loaded.quota) setQuota(loaded.quota);
      setSavedReports(loaded.reports);
    });
    return () => {
      cancelled = true;
    };
  }, [token, clientId, offerId]);

  useEffect(() => {
    if (lat == null || lng == null || !area) {
      setResult(null);
      onResultChange?.(null);
      if (!offerId) setError('Uzupełnij adres na mapie i powierzchnię.');
      else setError(null);
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
          onResultChange?.(null);
          setError(json.message);
        } else {
          setResult(json);
          onResultChange?.(json);
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
  }, [token, lat, lng, area, rooms, floor, city, district, address, listingPrice, purpose, onResultChange, offerId]);

  const payload = {
    lat, lng, area, rooms, floor, city, district, address, listingPrice,
    email,
    alternateEmail,
    clientId: clientId || undefined,
    offerId: offerId || undefined,
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
      if (sent.ok) {
        if (variant === 'pro') setSentPro(true);
        else setSentClassic(true);
        setReportMsg(
          `Wysłano ${variant === 'pro' ? 'wersję z mapą' : 'zestawienie transakcji'} na ${destLabel}.${sent.json?.clientRecorded ? ' Zapisano w panelu klienta i wysłano powiadomienie.' : ''} Limit się nie zmienił.`,
        );
        if (clientId && offerId) {
          void fetchOfferMarketReports(token, { clientId, offerId }).then((loaded) => {
            if (loaded.quota) setQuota(loaded.quota);
            setSavedReports(loaded.reports);
          });
        }
      } else {
        setReportMsg(String(sent.json?.message || 'Nie wysłano raportu.'));
      }
    });
  };

  const openSaved = (row: StoredOfferReport) => {
    setBusy(true);
    void fetchMarketReportPreview(token, row.id).then((preview) => {
      setBusy(false);
      if (!preview.ok) {
        setReportMsg(preview.message || 'Nie udało się otworzyć podglądu.');
        return;
      }
      setReportId(row.id);
      setHtmlClassic(String(preview.html || ''));
      setHtmlPro(String(preview.htmlPro || preview.html || ''));
      setSentClassic(row.sentClassic);
      setSentPro(row.sentPro);
      setReportMsg('Dwie wersje gotowe — przy każdej jest wysyłka do klienta.');
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
      setSentClassic(false);
      setSentPro(false);
      setReportMsg('Raport zapisany przy tej ofercie — 1 kredyt. Przy każdej wersji jest wysyłka do klienta.');
      if (clientId && offerId) {
        void fetchOfferMarketReports(token, { clientId, offerId }).then((loaded) => {
          if (loaded.quota) setQuota(loaded.quota);
          setSavedReports(loaded.reports);
        });
      }
    });
  };

  const startReport = () => {
    if (!result && !offerId) return;
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
      `Czy chcesz wygenerować raport dla:\n${propertyLabel}${propertyMeta ? `\n${propertyMeta}` : ''}\n\nTo zużyje 1 kredyt.${remainingHint}\nRaport zostanie zapisany przy tej ofercie. Wysyłka do klienta nic już nie zdejmie.`,
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
        <Text style={{ color: colors.accent, fontWeight: '900', fontSize: 10, letterSpacing: 1.2 }}>
          {compact ? 'RAPORT DLA KLIENTA' : 'ESTATEOS™ MARKET'}
        </Text>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13, marginTop: 3 }}>
          {compact ? 'Analiza wartości tej oferty (RCN)' : 'Rzeczywiste ceny transakcyjne (RCN)'}
        </Text>
      </View>
      <View style={{ padding: 14, gap: 10 }}>
        {loading ? <ActivityIndicator color={colors.accent} /> : null}
        {error && !compact ? <Text style={{ color: '#F59E0B', fontSize: 13, lineHeight: 18 }}>{error}</Text> : null}
        {result && !compact ? (
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
          </>
        ) : null}
        {compact || result || offerId ? (
          <>
            {compact && result ? (
              <Text style={{ color: colors.text, fontSize: 22, fontWeight: '900' }}>{formatPln(result.estimated.mid)}</Text>
            ) : null}
            {quota ? (
              <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 12 }}>
                {quota.cap != null ? `Wygenerowania: ${quota.remaining} / ${quota.cap} (${quota.windowLabel})` : quota.message}
              </Text>
            ) : null}
            <Text style={{ color: colors.secondary, fontSize: 12, lineHeight: 17 }}>
              Wygenerowanie zużywa 1 kredyt i zapisuje raport przy tej ofercie. Potem „Wyślij do klienta” pokazuje dwie wersje — każdą wysyłasz osobno.
            </Text>
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
            {compact ? null : (
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
            )}
            <Pressable
              onPress={startReport}
              disabled={busy}
              style={{
                backgroundColor: colors.accent,
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: 'center',
                opacity: busy ? 0.6 : 1,
              }}
            >
              <Text style={{ color: '#000', fontWeight: '900', fontSize: 13 }}>
                {busy ? 'Generuję…' : reportId ? 'Wygeneruj kolejny raport' : 'Wygeneruj raport dla tej oferty'}
              </Text>
            </Pressable>
            {reportId ? (
              <View style={{ gap: 8 }}>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13 }}>
                  Dwie wersje gotowe — przy każdej wyślij do klienta
                </Text>
                <View style={{ borderWidth: 1, borderColor: colors.accent, borderRadius: 12, padding: 12 }}>
                  <Text style={{ color: colors.text, fontWeight: '800' }}>Dla klienta · mapa i rekomendacja</Text>
                  <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 4, lineHeight: 17 }}>
                    {sentPro ? 'Wysłano do klienta.' : 'List z mapą aktów i rekomendacją ceny.'}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 8 }}>
                    <Pressable onPress={() => setPreviewVariant('pro')}>
                      <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>Podgląd</Text>
                    </Pressable>
                    <Pressable onPress={() => sendExisting(reportId, 'pro')} disabled={busy}>
                      <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 13 }}>
                        {sentPro ? 'Wyślij ponownie' : 'Wyślij do klienta'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
                <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12 }}>
                  <Text style={{ color: colors.text, fontWeight: '800' }}>Zestawienie transakcji</Text>
                  <Text style={{ color: colors.secondary, fontSize: 12, marginTop: 4, lineHeight: 17 }}>
                    {sentClassic ? 'Wysłano do klienta.' : 'List z tabelą aktów, bez mapy.'}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 8 }}>
                    <Pressable onPress={() => setPreviewVariant('classic')}>
                      <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>Podgląd</Text>
                    </Pressable>
                    <Pressable onPress={() => sendExisting(reportId, 'classic')} disabled={busy}>
                      <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 13 }}>
                        {sentClassic ? 'Wyślij ponownie' : 'Wyślij do klienta'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ) : savedReports[0] ? (
              <Pressable
                onPress={() => openSaved(savedReports[0])}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13 }}>Wyślij do klienta</Text>
              </Pressable>
            ) : null}
            {savedReports.length > 1 ? (
              <View style={{ gap: 6 }}>
                {savedReports.slice(0, 4).map((row) => (
                  <Pressable
                    key={row.id}
                    onPress={() => openSaved(row)}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 12,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13 }}>
                      {row.mid ? formatPln(row.mid) : 'Raport zapisany'}
                    </Text>
                    <Text style={{ color: colors.secondary, fontSize: 11, marginTop: 2 }}>
                      {new Date(row.createdAt).toLocaleDateString('pl-PL')}
                      {row.sentPro || row.sentClassic ? ' · wysłany' : ' · do wysyłki'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {reportMsg ? <Text style={{ color: colors.secondary, fontSize: 12, lineHeight: 17 }}>{reportMsg}</Text> : null}
            {result && !compact ? (
              <Text style={{ color: colors.secondary, fontSize: 10, lineHeight: 14 }}>{result.coverage.disclaimer}</Text>
            ) : null}
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
      <View style={{ flex: 1, backgroundColor: colors.bg || colors.card, paddingTop: 54 }}>
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

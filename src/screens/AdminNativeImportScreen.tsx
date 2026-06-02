import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_URL } from '../config/network';
import { useAuthStore } from '../store/useAuthStore';
import { useI18n } from '../i18n';
import { useThemeStore } from '../store/useThemeStore';
import { hasActiveInvestorProMembership } from '../utils/investorProMembership';

type ImportSource = 'OTODOM' | 'OLX' | 'NIERUCHOMOSCI_ONLINE';

type ImportDraft = {
  source: ImportSource;
  externalId: number;
  title: string;
  descriptionText?: string;
  imageCount: number;
  imageUrls: string[];
  price?: number | null;
  area?: number | null;
  rooms?: number | null;
  floor?: number | null;
  lat?: number | null;
  lng?: number | null;
  city?: string | null;
  district?: string | null;
  features?: string[];
  locationWarnings?: string[];
};

type ImportPresentation = {
  title: string;
  descriptionHtml: string;
};

export default function AdminNativeImportScreen() {
  const { t } = useI18n();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const isDark = useThemeStore((s) => s.getResolvedTheme() === 'dark');
  const theme = useMemo(
    () =>
      isDark
        ? { bg: '#000000', card: '#1C1C1E', border: 'rgba(255,255,255,0.08)', text: '#F5F5F7', sub: '#8E8E93' }
        : { bg: '#F2F2F7', card: '#FFFFFF', border: 'rgba(0,0,0,0.06)', text: '#111111', sub: '#6B7280' },
    [isDark]
  );

  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [presentation, setPresentation] = useState<ImportPresentation | null>(null);
  const [createdOfferId, setCreatedOfferId] = useState<number | null>(null);
  const [editUrl, setEditUrl] = useState('');
  const [publicUrl, setPublicUrl] = useState('');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const asMoney = (raw?: number | null) => (raw == null ? '—' : `${Number(raw).toLocaleString('pl-PL')} zł`);
  const asArea = (raw?: number | null) => (raw == null ? '—' : `${raw} m²`);
  const hasMap = Number.isFinite(Number(draft?.lat)) && Number.isFinite(Number(draft?.lng));

  const stripHtml = (html: string) =>
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

  const descriptionFull = useMemo(() => {
    if (presentation?.descriptionHtml) return stripHtml(String(presentation.descriptionHtml));
    return String(draft?.descriptionText || '').trim();
  }, [presentation?.descriptionHtml, draft?.descriptionText]);

  const locationPrecision = useMemo(() => {
    const warnings = Array.isArray(draft?.locationWarnings) ? draft?.locationWarnings : [];
    const joined = warnings.join(' ').toLowerCase();
    if (/przybliżon|obszar|approx/.test(joined)) return 'Obszarowa';
    return hasMap ? 'Dokładna' : 'Brak współrzędnych';
  }, [draft?.locationWarnings, hasMap]);

  const handleAnalyze = async () => {
    if (!token) {
      Alert.alert(t('common.error'), 'Brak sesji. Zaloguj się ponownie.');
      return;
    }
    const cleanUrl = url.trim();
    if (!cleanUrl) {
      Alert.alert(t('common.error'), 'Wklej link do oferty.');
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    setDraft(null);
    setPresentation(null);
    setCreatedOfferId(null);
    setEditUrl('');
    setPublicUrl('');
    try {
      let res = await fetch(`${API_URL}/api/mobile/v1/pro/otodom-import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: cleanUrl }),
      });
      if (res.status === 404) {
        // Backward compatibility: older API namespace
        res = await fetch(`${API_URL}/api/mobile/v1/admin/otodom-import`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ url: cleanUrl }),
        });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(String(data?.message || data?.error || `Błąd importu (${res.status})`));
        return;
      }
      setDraft((data.draft || null) as ImportDraft | null);
      setPresentation((data.presentation || null) as ImportPresentation | null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setError('Błąd połączenia z serwerem.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!token || !draft) return;
    Alert.alert('Utworzyć ofertę?', 'Utworzę ofertę PENDING na podstawie zaimportowanych danych.', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: 'Utwórz',
        style: 'default',
        onPress: async () => {
          setCreating(true);
          setError('');
          setMessage('');
          try {
            let res = await fetch(`${API_URL}/api/mobile/v1/pro/otodom-import/create`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ draft, rightsConfirmed: true }),
            });
            if (res.status === 404) {
              res = await fetch(`${API_URL}/api/mobile/v1/admin/otodom-import/create`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ draft, rightsConfirmed: true }),
              });
            }
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.success) {
              setError(String(data?.message || data?.error || `Błąd tworzenia oferty (${res.status})`));
              return;
            }
            setMessage(String(data?.message || 'Oferta utworzona.'));
            setCreatedOfferId(Number(data?.offerId || 0) || null);
            setEditUrl(String(data?.editUrl || ''));
            setPublicUrl(String(data?.publicUrl || ''));
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch {
            setError('Błąd połączenia podczas tworzenia oferty.');
          } finally {
            setCreating(false);
          }
        },
      },
    ]);
  };

  if (!hasActiveInvestorProMembership(user)) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <Ionicons name="shield-outline" size={32} color="#FF3B30" />
        <Text style={[styles.noAccessTitle, { color: theme.text }]}>Brak dostępu</Text>
        <Text style={[styles.noAccessBody, { color: theme.sub }]}>Ten ekran importu jest dostępny dla aktywnego Investor Pro.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40, paddingTop: Math.max(insets.top + 10, 28) }}
    >
      <View style={[styles.heroCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.heroTopRow}>
          <View style={[styles.heroIconWrap, { backgroundColor: isDark ? 'rgba(10,132,255,0.15)' : 'rgba(10,132,255,0.12)' }]}>
            <Ionicons name="sparkles" size={18} color="#0A84FF" />
          </View>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>PREMIUM IMPORT</Text>
          </View>
        </View>
        <Text style={[styles.heroTitle, { color: theme.text }]}>Import z portali</Text>
        <Text style={[styles.heroSubtitle, { color: theme.sub }]}>
          Wklej link OtoDom, OLX lub Nieruchomosci-Online. System wykryje portal i przygotuje draft oferty.
        </Text>
        <TextInput
          value={url}
          onChangeText={setUrl}
          placeholder="https://..."
          placeholderTextColor={isDark ? '#666' : '#9AA0A6'}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: isDark ? '#111114' : '#F9FAFB' }]}
        />
        <Pressable onPress={handleAnalyze} disabled={loading} style={[styles.primaryBtn, loading && styles.btnDisabled]}>
          {loading ? <ActivityIndicator color="#fff" /> : <Ionicons name="search" size={16} color="#fff" />}
          <Text style={styles.primaryBtnText}>{loading ? 'Analizowanie…' : 'Analizuj link'}</Text>
        </Pressable>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>

      {draft ? (
        <>
          <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Podgląd draftu</Text>
            <View style={styles.kpiRow}>
              <View style={[styles.kpiBox, { backgroundColor: isDark ? '#111114' : '#F9FAFB', borderColor: theme.border }]}>
                <Ionicons name="pricetag" size={16} color="#10B981" />
                <Text style={[styles.kpiValue, { color: theme.text }]} numberOfLines={1}>{asMoney(draft.price)}</Text>
                <Text style={[styles.kpiLabel, { color: theme.sub }]}>Cena</Text>
              </View>
              <View style={[styles.kpiBox, { backgroundColor: isDark ? '#111114' : '#F9FAFB', borderColor: theme.border }]}>
                <Ionicons name="resize" size={16} color="#0A84FF" />
                <Text style={[styles.kpiValue, { color: theme.text }]} numberOfLines={1}>{asArea(draft.area)}</Text>
                <Text style={[styles.kpiLabel, { color: theme.sub }]}>Powierzchnia</Text>
              </View>
              <View style={[styles.kpiBox, { backgroundColor: isDark ? '#111114' : '#F9FAFB', borderColor: theme.border }]}>
                <Ionicons name="home" size={16} color="#AF52DE" />
                <Text style={[styles.kpiValue, { color: theme.text }]} numberOfLines={1}>{draft.rooms ?? '—'}</Text>
                <Text style={[styles.kpiLabel, { color: theme.sub }]}>Pokoje</Text>
              </View>
            </View>

            <Text style={[styles.row, { color: theme.sub }]}>Źródło: <Text style={[styles.rowStrong, { color: theme.text }]}>{draft.source}</Text></Text>
            <Text style={[styles.row, { color: theme.sub }]}>Tytuł: <Text style={[styles.rowStrong, { color: theme.text }]}>{presentation?.title || draft.title}</Text></Text>
            <Text style={[styles.row, { color: theme.sub }]}>Lokalizacja: <Text style={[styles.rowStrong, { color: theme.text }]}>{[draft.district, draft.city].filter(Boolean).join(', ') || '—'}</Text></Text>
            <Text style={[styles.row, { color: theme.sub }]}>Tryb lokalizacji: <Text style={[styles.rowStrong, { color: theme.text }]}>{locationPrecision}</Text></Text>
            <Text style={[styles.row, { color: theme.sub }]}>Zdjęcia: <Text style={[styles.rowStrong, { color: theme.text }]}>{draft.imageCount}</Text></Text>
          </View>

          {!!draft.imageUrls?.length ? (
            <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Miniatury zdjęć</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbStrip}>
                {draft.imageUrls.slice(0, 16).map((uri, idx) => (
                  <Pressable
                    key={`${uri}-${idx}`}
                    style={[styles.thumbItem, { borderColor: theme.border }]}
                    onPress={() => {
                      setLightboxIndex(idx);
                      setLightboxOpen(true);
                    }}
                  >
                    <Image source={{ uri }} style={styles.thumbImage} resizeMode="cover" />
                  </Pressable>
                ))}
              </ScrollView>
              <Text style={[styles.lightboxHint, { color: theme.sub }]}>Dotknij miniatury, aby otworzyć pełny podgląd.</Text>
            </View>
          ) : null}

          {hasMap ? (
            <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Mapa podglądu</Text>
              <View style={[styles.mapWrap, { borderColor: theme.border }]}>
                <MapView
                  style={styles.map}
                  pointerEvents="none"
                  initialRegion={{
                    latitude: Number(draft?.lat),
                    longitude: Number(draft?.lng),
                    latitudeDelta: 0.018,
                    longitudeDelta: 0.018,
                  }}
                >
                  <Marker coordinate={{ latitude: Number(draft?.lat), longitude: Number(draft?.lng) }} />
                </MapView>
              </View>
            </View>
          ) : null}

          {descriptionFull ? (
            <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Pełny podgląd opisu</Text>
              <View style={[styles.descriptionCard, { backgroundColor: isDark ? '#111114' : '#F9FAFB', borderColor: theme.border }]}>
                <Text style={[styles.descriptionText, { color: theme.text }]}>{descriptionFull}</Text>
              </View>
            </View>
          ) : null}

          {!!draft.locationWarnings?.length ? (
            <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Ostrzeżenia importu</Text>
              <View style={styles.chipsWrap}>
                {draft.locationWarnings.map((warning, idx) => (
                  <View key={`${warning}-${idx}`} style={styles.warningChip}>
                    <Text style={styles.warningChipText}>{warning}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {!!draft.features?.length ? (
            <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Cechy oferty</Text>
              <View style={styles.chipsWrap}>
                {draft.features.map((feature, idx) => (
                  <View key={`${feature}-${idx}`} style={[styles.featureChip, { borderColor: theme.border, backgroundColor: isDark ? '#111114' : '#F9FAFB' }]}>
                    <Text style={[styles.featureChipText, { color: theme.text }]}>{feature}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Utworzenie oferty</Text>
          <Pressable onPress={handleCreate} disabled={creating} style={[styles.successBtn, creating && styles.btnDisabled]}>
            {creating ? <ActivityIndicator color="#fff" /> : <Ionicons name="add-circle" size={16} color="#fff" />}
            <Text style={styles.primaryBtnText}>{creating ? 'Tworzenie…' : 'Utwórz ofertę'}</Text>
          </Pressable>

          {message ? <Text style={styles.successText}>{message}</Text> : null}

          {createdOfferId ? (
            <View style={styles.linksRow}>
              <Pressable
                style={[styles.linkBtn, { borderColor: theme.border }]}
                onPress={() => {
                  if (!editUrl) return;
                  void Linking.openURL(`${API_URL}${editUrl.startsWith('/') ? editUrl : `/${editUrl}`}`);
                }}
              >
                <Text style={[styles.linkText, { color: theme.text }]}>Edytuj #{createdOfferId}</Text>
              </Pressable>
              <Pressable
                style={[styles.linkBtn, { borderColor: theme.border }]}
                onPress={() => {
                  if (!publicUrl) return;
                  void Linking.openURL(`${API_URL}${publicUrl.startsWith('/') ? publicUrl : `/${publicUrl}`}`);
                }}
              >
                <Text style={[styles.linkText, { color: theme.text }]}>Podgląd</Text>
              </Pressable>
            </View>
          ) : null}
          </View>
        </>
      ) : null}

      <Modal visible={lightboxOpen} animationType="fade" transparent onRequestClose={() => setLightboxOpen(false)}>
        <View style={styles.lightboxBackdrop}>
          <View style={[styles.lightboxHeader, { paddingTop: Math.max(insets.top, 10) }]}>
            <Text style={styles.lightboxCounter}>
              {lightboxIndex + 1} / {draft?.imageUrls?.length || 0}
            </Text>
            <Pressable onPress={() => setLightboxOpen(false)} style={styles.lightboxClose}>
              <Ionicons name="close" size={18} color="#fff" />
            </Pressable>
          </View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: lightboxIndex * screenWidth, y: 0 }}
            onMomentumScrollEnd={(e) => {
              const width = e.nativeEvent.layoutMeasurement.width || 1;
              const idx = Math.round(e.nativeEvent.contentOffset.x / width);
              setLightboxIndex(Math.max(0, idx));
            }}
          >
            {(draft?.imageUrls || []).map((uri, idx) => (
              <View key={`${uri}-full-${idx}`} style={[styles.lightboxSlide, { width: screenWidth }]}>
                <Image source={{ uri }} style={styles.lightboxImage} resizeMode="contain" />
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  noAccessTitle: { marginTop: 10, fontSize: 20, fontWeight: '800' },
  noAccessBody: { marginTop: 8, textAlign: 'center', fontSize: 14, lineHeight: 20 },
  heroCard: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 12 },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  heroIconWrap: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  heroBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: 'rgba(10,132,255,0.16)' },
  heroBadgeText: { color: '#0A84FF', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  heroTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  heroSubtitle: { marginTop: 6, fontSize: 13, lineHeight: 18 },
  input: { marginTop: 14, borderWidth: 1, borderRadius: 12, minHeight: 46, paddingHorizontal: 12, fontSize: 15 },
  primaryBtn: { marginTop: 12, borderRadius: 12, minHeight: 46, backgroundColor: '#007AFF', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  successBtn: { marginTop: 14, borderRadius: 12, minHeight: 46, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  btnDisabled: { opacity: 0.65 },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  errorText: { marginTop: 10, color: '#FF3B30', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  successText: { marginTop: 10, color: '#10B981', fontSize: 13, lineHeight: 18, fontWeight: '600' },
  sectionCard: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 10 },
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  kpiBox: { flex: 1, borderWidth: 1, borderRadius: 12, minHeight: 82, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  kpiValue: { fontSize: 14, fontWeight: '800', marginTop: 6 },
  kpiLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  row: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  rowStrong: { fontWeight: '700' },
  thumbStrip: { gap: 10, paddingRight: 6 },
  thumbItem: { width: 116, height: 84, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  thumbImage: { width: '100%', height: '100%' },
  lightboxHint: { marginTop: 8, fontSize: 12, lineHeight: 16, fontWeight: '500' },
  mapWrap: { borderRadius: 12, borderWidth: 1, overflow: 'hidden', height: 220 },
  map: { width: '100%', height: '100%' },
  descriptionCard: { borderWidth: 1, borderRadius: 12, padding: 12 },
  descriptionText: { fontSize: 14, lineHeight: 21 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  warningChip: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: 'rgba(255,149,0,0.14)', borderWidth: 1, borderColor: 'rgba(255,149,0,0.32)' },
  warningChipText: { color: '#FF9500', fontSize: 12, fontWeight: '700', lineHeight: 16 },
  featureChip: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1 },
  featureChipText: { fontSize: 12, fontWeight: '600', lineHeight: 16 },
  linksRow: { marginTop: 12, flexDirection: 'row', gap: 10 },
  linkBtn: { flex: 1, minHeight: 42, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  linkText: { fontSize: 13, fontWeight: '700' },
  lightboxBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)' },
  lightboxHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 },
  lightboxCounter: { color: '#fff', fontSize: 14, fontWeight: '700' },
  lightboxClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  lightboxSlide: { height: '100%', alignItems: 'center', justifyContent: 'center' },
  lightboxImage: { width: '100%', height: '84%' },
});

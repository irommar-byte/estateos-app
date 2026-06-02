import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { API_URL } from '../config/network';
import { useAuthStore } from '../store/useAuthStore';
import { useI18n } from '../i18n';
import { useThemeStore } from '../store/useThemeStore';

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
  city?: string | null;
  district?: string | null;
};

type ImportPresentation = {
  title: string;
  descriptionHtml: string;
};

export default function AdminNativeImportScreen() {
  const { t } = useI18n();
  const token = useAuthStore((s) => s.token);
  const userRole = String(useAuthStore((s) => s.user?.role) || '').toUpperCase();
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

  const asMoney = (raw?: number | null) => (raw == null ? '—' : `${Number(raw).toLocaleString('pl-PL')} zł`);
  const asArea = (raw?: number | null) => (raw == null ? '—' : `${raw} m²`);

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
      const res = await fetch(`${API_URL}/api/mobile/v1/admin/otodom-import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: cleanUrl }),
      });
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
            const res = await fetch(`${API_URL}/api/mobile/v1/admin/otodom-import/create`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ draft, rightsConfirmed: true }),
            });
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

  if (userRole !== 'ADMIN') {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <Ionicons name="shield-outline" size={32} color="#FF3B30" />
        <Text style={[styles.noAccessTitle, { color: theme.text }]}>Brak dostępu</Text>
        <Text style={[styles.noAccessBody, { color: theme.sub }]}>Ten ekran importu jest dostępny tylko dla administratora.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={[styles.heroCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
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
        <View style={[styles.sectionCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Podgląd draftu</Text>
          <Text style={[styles.row, { color: theme.sub }]}>Źródło: <Text style={[styles.rowStrong, { color: theme.text }]}>{draft.source}</Text></Text>
          <Text style={[styles.row, { color: theme.sub }]}>Tytuł: <Text style={[styles.rowStrong, { color: theme.text }]}>{presentation?.title || draft.title}</Text></Text>
          <Text style={[styles.row, { color: theme.sub }]}>Cena: <Text style={[styles.rowStrong, { color: theme.text }]}>{asMoney(draft.price)}</Text></Text>
          <Text style={[styles.row, { color: theme.sub }]}>Powierzchnia: <Text style={[styles.rowStrong, { color: theme.text }]}>{asArea(draft.area)}</Text></Text>
          <Text style={[styles.row, { color: theme.sub }]}>Pokoje: <Text style={[styles.rowStrong, { color: theme.text }]}>{draft.rooms ?? '—'}</Text></Text>
          <Text style={[styles.row, { color: theme.sub }]}>Lokalizacja: <Text style={[styles.rowStrong, { color: theme.text }]}>{[draft.district, draft.city].filter(Boolean).join(', ') || '—'}</Text></Text>
          <Text style={[styles.row, { color: theme.sub }]}>Zdjęcia: <Text style={[styles.rowStrong, { color: theme.text }]}>{draft.imageCount}</Text></Text>

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
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  noAccessTitle: { marginTop: 10, fontSize: 20, fontWeight: '800' },
  noAccessBody: { marginTop: 8, textAlign: 'center', fontSize: 14, lineHeight: 20 },
  heroCard: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 12 },
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
  row: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  rowStrong: { fontWeight: '700' },
  linksRow: { marginTop: 12, flexDirection: 'row', gap: 10 },
  linkBtn: { flex: 1, minHeight: 42, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  linkText: { fontSize: 13, fontWeight: '700' },
});

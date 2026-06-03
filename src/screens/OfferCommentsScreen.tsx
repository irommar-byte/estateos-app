import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_URL } from '../config/network';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';

type RouteParams = {
  offerId?: number;
  offerTitle?: string;
};

type PrivateNoteApi = {
  userNote: string;
  importSource: string | null;
  importExternalUrl: string | null;
  importExternalId: string | null;
  importSnapshotJson: string | null;
  sourceIsActive: boolean | null;
  sourceLastCheckAt: string | null;
  sourceLastHttpStatus: number | null;
  sourceLastError: string | null;
};

type ImportSnapshot = {
  titleOriginal?: string;
  descriptionOriginalText?: string;
  descriptionOriginalHtml?: string;
  contactHints?: {
    agencyName?: string | null;
    phone?: string | null;
    address?: string | null;
  };
  fullDraft?: {
    floor?: number | null;
    transactionType?: string;
  };
};

function formatFloorLabel(floor: number | null | undefined): string {
  if (floor == null) return '—';
  if (floor === 0) return 'parter (0)';
  return String(floor);
}

export default function OfferCommentsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { offerId: rawOfferId, offerTitle: initialTitle } = (route.params || {}) as RouteParams;
  const offerId = Number(rawOfferId);
  const token = useAuthStore((s) => s.token);
  const isDark = useThemeStore((s) => s.getResolvedTheme() === 'dark');

  const theme = useMemo(
    () =>
      isDark
        ? { bg: '#000000', card: '#1C1C1E', border: 'rgba(255,255,255,0.08)', text: '#F5F5F7', sub: '#8E8E93' }
        : { bg: '#F2F2F7', card: '#FFFFFF', border: 'rgba(0,0,0,0.06)', text: '#111111', sub: '#6B7280' },
    [isDark],
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [offerTitle, setOfferTitle] = useState(String(initialTitle || '').trim());
  const [note, setNote] = useState<PrivateNoteApi | null>(null);
  const [userNote, setUserNote] = useState('');

  const parsedSnapshot = useMemo<ImportSnapshot | null>(() => {
    if (!note?.importSnapshotJson) return null;
    try {
      return JSON.parse(note.importSnapshotJson) as ImportSnapshot;
    } catch {
      return null;
    }
  }, [note?.importSnapshotJson]);

  const originalDescription = useMemo(() => {
    const text = String(parsedSnapshot?.descriptionOriginalText || '').trim();
    if (text) return text;
    const html = String(parsedSnapshot?.descriptionOriginalHtml || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return html;
  }, [parsedSnapshot]);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('MainTabs');
  }, [navigation]);

  const loadNote = useCallback(async () => {
    if (!Number.isFinite(offerId) || offerId <= 0 || !token) {
      setLoading(false);
      setError('Brak poprawnego ID oferty lub sesji.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/mobile/v1/offers/${offerId}/private-note`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        const fallback =
          res.status === 404
            ? 'Nie znaleziono oferty na serwerze — odśwież listę „Moje ogłoszenia” i spróbuj ponownie.'
            : res.status === 403
              ? 'Brak uprawnień do komentarzy tej oferty.'
              : `Błąd ${res.status}`;
        throw new Error(String(data?.message || data?.error || fallback));
      }
      const row = (data?.note || null) as PrivateNoteApi | null;
      setNote(row);
      setUserNote(String(row?.userNote || ''));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się pobrać komentarza.');
    } finally {
      setLoading(false);
    }
  }, [offerId, token]);

  useEffect(() => {
    void loadNote();
  }, [loadNote]);

  useEffect(() => {
    if (!Number.isFinite(offerId) || offerId <= 0 || !token || offerTitle) return;
    void fetch(`${API_URL}/api/mobile/v1/offers/${offerId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json().catch(() => ({})))
      .then((json) => {
        const title = String(json?.offer?.title || '').trim();
        if (title) setOfferTitle(title);
      })
      .catch(() => undefined);
  }, [offerId, token, offerTitle]);

  const handleSave = async () => {
    if (!token || !Number.isFinite(offerId) || offerId <= 0) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/mobile/v1/offers/${offerId}/private-note`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userNote: userNote.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(String(data?.message || data?.error || `Błąd ${res.status}`));
      }
      setNote((prev) =>
        prev
          ? { ...prev, userNote: String(data?.note?.userNote ?? userNote.trim()) }
          : { userNote: String(data?.note?.userNote ?? userNote.trim()) } as PrivateNoteApi,
      );
      Alert.alert('Zapisano', 'Komentarz został zapisany.');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Nie udało się zapisać komentarza.';
      setError(message);
      Alert.alert('Błąd', message);
    } finally {
      setSaving(false);
    }
  };

  const openSourceUrl = () => {
    const url = String(note?.importExternalUrl || '').trim();
    if (!url) return;
    void Linking.openURL(url);
  };

  const sourceStatusLabel = (() => {
    if (note?.sourceIsActive === true) return { text: 'Link źródłowy aktywny', tone: '#10B981' };
    if (note?.sourceIsActive === false) return { text: 'Oferta źródłowa prawdopodobnie wygasła', tone: '#FF3B30' };
    return { text: 'Status linku: niezweryfikowany', tone: theme.sub };
  })();

  return (
    <View style={[styles.root, { backgroundColor: theme.bg, paddingTop: insets.top + 8 }]}>
      <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.65 }]}
        >
          <Ionicons name="chevron-back" size={22} color={theme.text} />
          <Text style={[styles.backText, { color: theme.text }]}>Wróć</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text }]}>Komentarze</Text>
          <Text style={[styles.subtitle, { color: theme.sub }]} numberOfLines={2}>
            {offerTitle || (Number.isFinite(offerId) && offerId > 0 ? `Oferta #${offerId}` : 'Oferta')}
          </Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Prywatna notatka</Text>
          <Text style={[styles.hint, { color: theme.sub }]}>Widoczna tylko dla Ciebie — synchronizowana z kontem.</Text>
          <TextInput
            multiline
            value={userNote}
            onChangeText={setUserNote}
            placeholder="Dodaj notatkę, ustalenia, follow-up…"
            placeholderTextColor={isDark ? '#666' : '#9AA0A6'}
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: isDark ? '#111114' : '#F9FAFB' }]}
          />
          <Pressable onPress={handleSave} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.6 }]}>
            {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="save" size={16} color="#fff" />}
            <Text style={styles.saveBtnText}>Zapisz komentarz</Text>
          </Pressable>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Dane importu (oryginał)</Text>
          {loading ? <ActivityIndicator color="#0A84FF" style={{ marginVertical: 10 }} /> : null}

          {!loading ? (
            <>
              <View style={styles.badgeRow}>
                <View style={[styles.badge, { borderColor: theme.border }]}>
                  <Text style={[styles.badgeText, { color: theme.text }]}>
                    Źródło: {note?.importSource || 'brak'}
                  </Text>
                </View>
                <View style={[styles.badge, { borderColor: `${sourceStatusLabel.tone}55` }]}>
                  <Text style={[styles.badgeText, { color: sourceStatusLabel.tone }]}>{sourceStatusLabel.text}</Text>
                </View>
              </View>

              {note?.importExternalUrl ? (
                <Pressable onPress={openSourceUrl} style={styles.linkRow}>
                  <Ionicons name="open-outline" size={16} color="#0A84FF" />
                  <Text style={styles.linkText} numberOfLines={2}>
                    {note.importExternalUrl}
                  </Text>
                </Pressable>
              ) : (
                <Text style={[styles.line, { color: theme.sub }]}>Brak zapisanego adresu źródłowego.</Text>
              )}

              {note?.importExternalId ? (
                <Text style={[styles.line, { color: theme.sub }]}>
                  ID źródła: <Text style={[styles.strong, { color: theme.text }]}>{note.importExternalId}</Text>
                </Text>
              ) : null}

              {parsedSnapshot?.titleOriginal ? (
                <Text style={[styles.line, { color: theme.sub }]}>
                  Tytuł (oryginał): <Text style={[styles.strong, { color: theme.text }]}>{parsedSnapshot.titleOriginal}</Text>
                </Text>
              ) : null}

              {parsedSnapshot?.fullDraft?.floor != null ? (
                <Text style={[styles.line, { color: theme.sub }]}>
                  Piętro (oryginał):{' '}
                  <Text style={[styles.strong, { color: theme.text }]}>
                    {formatFloorLabel(parsedSnapshot.fullDraft.floor)}
                  </Text>
                </Text>
              ) : null}

              {parsedSnapshot?.contactHints ? (
                <View style={[styles.contactCard, { borderColor: theme.border, backgroundColor: isDark ? '#111114' : '#F9FAFB' }]}>
                  <Text style={[styles.contactTitle, { color: theme.text }]}>Kontakt źródłowy</Text>
                  <Text style={[styles.line, { color: theme.sub }]}>
                    Firma / osoba:{' '}
                    <Text style={[styles.strong, { color: theme.text }]}>
                      {parsedSnapshot.contactHints.agencyName || '—'}
                    </Text>
                  </Text>
                  <Text style={[styles.line, { color: theme.sub }]}>
                    Telefon:{' '}
                    <Text style={[styles.strong, { color: theme.text }]}>{parsedSnapshot.contactHints.phone || '—'}</Text>
                  </Text>
                  <Text style={[styles.line, { color: theme.sub }]}>
                    Adres:{' '}
                    <Text style={[styles.strong, { color: theme.text }]}>{parsedSnapshot.contactHints.address || '—'}</Text>
                  </Text>
                </View>
              ) : null}

              {originalDescription ? (
                <View style={[styles.descriptionWrap, { borderColor: theme.border, backgroundColor: isDark ? '#111114' : '#F9FAFB' }]}>
                  <Text style={[styles.contactTitle, { color: theme.text }]}>Oryginalny opis (bez zmian)</Text>
                  <Text style={[styles.description, { color: theme.text }]}>{originalDescription}</Text>
                </View>
              ) : (
                <Text style={[styles.line, { color: theme.sub }]}>
                  Brak zapisanego oryginalnego opisu. Dotyczy ofert utworzonych przed wdrożeniem archiwum importu.
                </Text>
              )}

              {note?.sourceLastCheckAt ? (
                <Text style={[styles.meta, { color: theme.sub }]}>
                  Ostatnia weryfikacja linku: {new Date(note.sourceLastCheckAt).toLocaleString('pl-PL')}
                </Text>
              ) : null}
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { paddingHorizontal: 12, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', minHeight: 44, paddingHorizontal: 4 },
  backText: { fontSize: 16, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '900', letterSpacing: -0.4 },
  subtitle: { marginTop: 4, fontSize: 13, lineHeight: 18 },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  hint: { fontSize: 12, marginBottom: 10 },
  line: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  strong: { fontWeight: '800' },
  meta: { fontSize: 11, marginTop: 8 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  linkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  linkText: { flex: 1, color: '#0A84FF', fontSize: 13, fontWeight: '600' },
  contactCard: { borderWidth: 1, borderRadius: 12, padding: 10, marginTop: 8, marginBottom: 8 },
  contactTitle: { fontSize: 13, fontWeight: '800', marginBottom: 6 },
  descriptionWrap: { borderWidth: 1, borderRadius: 12, padding: 10, marginTop: 4 },
  description: { fontSize: 13, lineHeight: 20 },
  input: { borderWidth: 1, borderRadius: 12, minHeight: 120, textAlignVertical: 'top', paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  saveBtn: {
    marginTop: 12,
    borderRadius: 12,
    minHeight: 46,
    backgroundColor: '#0A84FF',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  errorText: { color: '#FF3B30', fontSize: 13, marginBottom: 10, paddingHorizontal: 4 },
});

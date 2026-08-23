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
import { shapeOfferPrivateNoteView } from '../lib/offerPrivateNoteView';

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

function phoneHref(raw: string | null): string | null {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length < 9) return null;
  return `tel:+48${digits.length === 9 ? digits : digits.replace(/^48/, '')}`;
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

  const view = useMemo(() => shapeOfferPrivateNoteView(note?.importSnapshotJson), [note?.importSnapshotJson]);
  const callHref = phoneHref(view.phone);

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

  const sourceLive = note?.sourceIsActive === true;
  const sourceDead = note?.sourceIsActive === false;
  const sourceStatusLabel = sourceLive
    ? { text: 'Aktywne na portalu', tone: '#10B981' }
    : sourceDead
      ? { text: 'Prawdopodobnie wygasło / wycofane', tone: '#FF3B30' }
      : { text: 'Jeszcze nie sprawdzone', tone: theme.sub };

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
          <View style={styles.badgeRow}>
            <View style={[styles.seal, sourceDead ? styles.sealDead : sourceLive ? styles.sealLive : styles.sealIdle]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.contactTitle, { color: theme.text }]}>Jakość źródła</Text>
              <Text style={[styles.line, { color: sourceStatusLabel.tone }]}>{sourceStatusLabel.text}</Text>
              {note?.sourceLastCheckAt ? (
                <Text style={[styles.meta, { color: theme.sub }]}>
                  Sprawdzone {new Date(note.sourceLastCheckAt).toLocaleString('pl-PL')}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Kontakt</Text>
          <Text style={[styles.line, { color: theme.sub }]}>
            Telefon KEI: <Text style={[styles.strong, { color: theme.text }]}>{view.keiPhone || '—'}</Text>
          </Text>
          <Text style={[styles.line, { color: theme.sub }]}>
            Telefon z portalu: <Text style={[styles.strong, { color: theme.text }]}>{view.portalPhone || '—'}</Text>
          </Text>
          <Text style={[styles.line, { color: theme.sub }]}>
            Osoba / biuro: <Text style={[styles.strong, { color: theme.text }]}>{view.agencyName || '—'}</Text>
          </Text>
          <View style={styles.badgeRow}>
            {callHref ? (
              <Pressable onPress={() => void Linking.openURL(callHref)} style={styles.saveBtn}>
                <Ionicons name="call" size={16} color="#022c22" />
                <Text style={[styles.saveBtnText, { color: '#022c22' }]}>Zadzwoń</Text>
              </Pressable>
            ) : null}
            {note?.importExternalUrl ? (
              <Pressable onPress={openSourceUrl} style={[styles.saveBtn, styles.ghostBtn]}>
                <Ionicons name="open-outline" size={16} color={theme.text} />
                <Text style={[styles.saveBtnText, { color: theme.text }]}>Źródło</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Źródło KEI</Text>
          {loading ? <ActivityIndicator color="#10B981" style={{ marginVertical: 10 }} /> : null}
          {!loading ? (
            <>
              <Text style={[styles.line, { color: theme.sub }]}>
                ID: <Text style={[styles.strong, { color: theme.text }]}>{view.keiId || '—'}</Text>
              </Text>
              <Text style={[styles.line, { color: theme.sub }]}>
                Adres: <Text style={[styles.strong, { color: theme.text }]}>{view.keiAddress || view.contactAddress || '—'}</Text>
              </Text>
              <Text style={[styles.line, { color: theme.sub }]}>
                {[view.keiDistrict, view.keiStreet, view.keiRooms ? `${view.keiRooms} pok.` : null].filter(Boolean).join(' · ') ||
                  'Brak dodatkowych danych KEI'}
              </Text>
            </>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Portal</Text>
          <Text style={[styles.line, { color: theme.text }]}>{note?.importSource || 'brak'} · {view.titleOriginal || offerTitle || '—'}</Text>
          {view.descriptionOriginalText ? (
            <Text style={[styles.description, { color: theme.text }]}>{view.descriptionOriginalText}</Text>
          ) : (
            <Text style={[styles.line, { color: theme.sub }]}>Brak oryginalnego opisu — oferta sprzed archiwum importu.</Text>
          )}
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Twoje notatki</Text>
          <Text style={[styles.hint, { color: theme.sub }]}>Widoczne tylko dla Ciebie.</Text>
          <TextInput
            multiline
            value={userNote}
            onChangeText={setUserNote}
            placeholder="Ustalenia, follow-up, kto odbiera…"
            placeholderTextColor={isDark ? '#666' : '#9AA0A6'}
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: isDark ? '#111114' : '#F9FAFB' }]}
          />
          <Pressable onPress={handleSave} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.6 }]}>
            {saving ? <ActivityIndicator color="#022c22" /> : <Ionicons name="save" size={16} color="#022c22" />}
            <Text style={[styles.saveBtnText, { color: '#022c22' }]}>Zapisz notatkę</Text>
          </Pressable>
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
    borderRadius: 999,
    minHeight: 46,
    paddingHorizontal: 16,
    backgroundColor: '#34D399',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  ghostBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(196,163,90,0.35)',
  },
  saveBtnText: { color: '#022c22', fontWeight: '800', fontSize: 13, letterSpacing: 0.4, textTransform: 'uppercase' },
  seal: { width: 14, height: 14, borderRadius: 999, marginTop: 4 },
  sealLive: { backgroundColor: '#22C55E', shadowColor: '#22C55E', shadowOpacity: 0.7, shadowRadius: 6 },
  sealDead: { backgroundColor: '#EF4444', shadowColor: '#EF4444', shadowOpacity: 0.8, shadowRadius: 6 },
  sealIdle: { backgroundColor: '#9CA3AF' },
  errorText: { color: '#FF3B30', fontSize: 13, marginBottom: 10, paddingHorizontal: 4 },
});

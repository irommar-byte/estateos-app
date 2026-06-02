import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import { API_URL } from '../config/network';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';

type RouteParams = {
  offerId?: number;
  offerTitle?: string;
};

const localKey = (offerId: number) => `offer-comments-note:${offerId}`;

export default function OfferCommentsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { offerId: rawOfferId, offerTitle: initialTitle } = (route.params || {}) as RouteParams;
  const offerId = Number(rawOfferId);
  const token = useAuthStore((s) => s.token);
  const isDark = useThemeStore((s) => s.getResolvedTheme() === 'dark');

  const theme = useMemo(
    () =>
      isDark
        ? { bg: '#000000', card: '#1C1C1E', border: 'rgba(255,255,255,0.08)', text: '#F5F5F7', sub: '#8E8E93' }
        : { bg: '#F2F2F7', card: '#FFFFFF', border: 'rgba(0,0,0,0.06)', text: '#111111', sub: '#6B7280' },
    [isDark]
  );

  const [loading, setLoading] = useState(false);
  const [offerTitle, setOfferTitle] = useState(String(initialTitle || '').trim());
  const [description, setDescription] = useState('');
  const [localComment, setLocalComment] = useState('');
  const [saving, setSaving] = useState(false);
  const entryOpacity = useRef(new Animated.Value(0)).current;
  const entryScale = useRef(new Animated.Value(0.975)).current;

  useEffect(() => {
    if (!Number.isFinite(offerId) || offerId <= 0) return;
    void (async () => {
      const saved = await AsyncStorage.getItem(localKey(offerId));
      if (saved) setLocalComment(saved);
    })();
  }, [offerId]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(entryOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(entryScale, {
        toValue: 1,
        damping: 14,
        stiffness: 190,
        mass: 0.7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [entryOpacity, entryScale]);

  useEffect(() => {
    if (!Number.isFinite(offerId) || offerId <= 0 || !token) return;
    let alive = true;
    setLoading(true);
    void fetch(`${API_URL}/api/mobile/v1/offers/${offerId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json().catch(() => ({})))
      .then((json) => {
        if (!alive) return;
        const offer = json?.offer || null;
        if (!offer) return;
        setOfferTitle(String(offer.title || `Oferta #${offerId}`));
        setDescription(String(offer.description || ''));
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [offerId, token]);

  const importMarker = useMemo(() => {
    const match = description.match(/<!--\s*(estateos-[a-z]+:\d+)\s*-->/i);
    return match?.[1] || null;
  }, [description]);

  const shortDescription = useMemo(() => {
    return description
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1200);
  }, [description]);

  const handleSave = async () => {
    if (!Number.isFinite(offerId) || offerId <= 0) return;
    try {
      setSaving(true);
      await AsyncStorage.setItem(localKey(offerId), localComment.trim());
      Alert.alert('Zapisano', 'Komentarz został zapisany natywnie w aplikacji.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Animated.View style={{ flex: 1, opacity: entryOpacity, transform: [{ scale: entryScale }] }}>
      <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 36 }}>
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backRow}>
          <Ionicons name="chevron-back" size={17} color={theme.text} />
          <Text style={[styles.backText, { color: theme.text }]}>Wróć</Text>
        </Pressable>
        <Text style={[styles.title, { color: theme.text }]}>Komentarze</Text>
        <Text style={[styles.subtitle, { color: theme.sub }]} numberOfLines={2}>
          {offerTitle || (Number.isFinite(offerId) && offerId > 0 ? `Oferta #${offerId}` : 'Oferta')}
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Dane importu</Text>
        {loading ? <ActivityIndicator color="#0A84FF" style={{ marginVertical: 8 }} /> : null}
        <Text style={[styles.line, { color: theme.sub }]}>
          Marker importu: <Text style={[styles.strong, { color: theme.text }]}>{importMarker || 'Brak'}</Text>
        </Text>
        <Text style={[styles.line, { color: theme.sub }]}>
          Źródło opisu: <Text style={[styles.strong, { color: theme.text }]}>{shortDescription ? 'Załadowane' : 'Brak'}</Text>
        </Text>
        {shortDescription ? (
          <View style={[styles.descriptionWrap, { borderColor: theme.border, backgroundColor: isDark ? '#111114' : '#F9FAFB' }]}>
            <Text style={[styles.description, { color: theme.text }]}>{shortDescription}</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Prywatna notatka</Text>
        <TextInput
          multiline
          value={localComment}
          onChangeText={setLocalComment}
          placeholder="Dodaj notatkę do tej oferty (lokalnie w aplikacji)"
          placeholderTextColor={isDark ? '#666' : '#9AA0A6'}
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: isDark ? '#111114' : '#F9FAFB' }]}
        />
        <Pressable onPress={handleSave} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.6 }]}>
          {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="save" size={16} color="#fff" />}
          <Text style={styles.saveBtnText}>Zapisz komentarz</Text>
        </Pressable>
      </View>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 12 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', marginBottom: 10 },
  backText: { fontSize: 14, fontWeight: '700' },
  title: { fontSize: 24, fontWeight: '900', letterSpacing: -0.4 },
  subtitle: { marginTop: 4, fontSize: 13, lineHeight: 18 },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  line: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  strong: { fontWeight: '800' },
  descriptionWrap: { borderWidth: 1, borderRadius: 12, padding: 10, marginTop: 8 },
  description: { fontSize: 13, lineHeight: 20 },
  input: { borderWidth: 1, borderRadius: 12, minHeight: 140, textAlignVertical: 'top', paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
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
});

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NavigationProp } from '@react-navigation/native';
import EosSpotlightLensButton from './EosSpotlightLensButton';
import {
  fetchSpotlightSearch,
  parseSpotlightOfferId,
  spotlightHrefToAbsolute,
  type SpotlightResult,
  type SpotlightSection,
} from '../../services/spotlightSearchService';
import { pushSpotlightRecent, readSpotlightRecent, type SpotlightRecentItem } from '../../utils/spotlightSearchHistory';
import { useAuthStore } from '../../store/useAuthStore';
import ApplePressable from '../ApplePressable';

type Props = {
  visible: boolean;
  onClose: () => void;
  isDark: boolean;
  navigation: NavigationProp<Record<string, unknown>>;
};

function kindLabel(kind: SpotlightResult['kind']) {
  if (kind === 'offer') return 'Oferta';
  if (kind === 'agency') return 'Biuro';
  return 'Agent';
}

function kindIcon(kind: SpotlightResult['kind']): keyof typeof Ionicons.glyphMap {
  if (kind === 'offer') return 'home-outline';
  if (kind === 'agency') return 'business-outline';
  return 'person-outline';
}

function SkeletonBlock({ isDark }: { isDark: boolean }) {
  const bg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
  return (
    <View style={styles.skeletonRow}>
      <View style={[styles.skeletonThumb, { backgroundColor: bg }]} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={[styles.skeletonLine, { width: '72%', backgroundColor: bg }]} />
        <View style={[styles.skeletonLine, { width: '52%', backgroundColor: bg }]} />
      </View>
    </View>
  );
}

export default function EosSpotlightModal({ visible, onClose, isDark, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const token = useAuthStore((state) => state.token);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SpotlightResult[]>([]);
  const [sections, setSections] = useState<SpotlightSection[]>([]);
  const [recent, setRecent] = useState<SpotlightRecentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [tookMs, setTookMs] = useState(0);
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestRef = useRef(0);

  const palette = useMemo(
    () => ({
      card: isDark ? 'rgba(22,22,24,0.96)' : 'rgba(255,255,255,0.98)',
      border: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)',
      text: isDark ? '#F5F5F7' : '#1D1D1F',
      muted: isDark ? '#9CA3AF' : '#6B7280',
      subtle: isDark ? '#6B7280' : '#94A3B8',
      accentSoft: isDark ? 'rgba(16,185,129,0.16)' : 'rgba(16,185,129,0.12)',
      input: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)',
    }),
    [isDark],
  );

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
      setSections([]);
      setLoading(false);
      setTookMs(0);
      abortRef.current?.abort();
      return;
    }
    void readSpotlightRecent().then(setRecent);
    const timer = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, [visible]);

  const runSearch = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) {
        setResults([]);
        setSections([]);
        setTookMs(0);
        setLoading(false);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const requestId = ++requestRef.current;
      setLoading(true);

      try {
        const payload = await fetchSpotlightSearch(trimmed, token, controller.signal);
        if (requestId !== requestRef.current) return;
        setResults(payload.results);
        setSections(payload.sections);
        setTookMs(payload.tookMs);
      } catch {
        if (requestId === requestRef.current) {
          setResults([]);
          setSections([]);
        }
      } finally {
        if (requestId === requestRef.current) setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (!visible) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch(query);
    }, 110);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [visible, query, runSearch]);

  const openResult = async (item: SpotlightResult) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (query.trim()) {
      const next = await pushSpotlightRecent(query.trim());
      setRecent(next);
    }
    onClose();
    Keyboard.dismiss();

    if (item.kind === 'offer') {
      const offerId = parseSpotlightOfferId(item.href);
      if (offerId) {
        navigation.navigate('OfferDetail', { offerId, id: offerId });
        return;
      }
    }

    const url = spotlightHrefToAbsolute(item.href);
    const { Linking } = await import('react-native');
    void Linking.openURL(url);
  };

  const renderResult = (item: SpotlightResult) => (
    <ApplePressable
      key={item.id}
      onPress={() => void openResult(item)}
      haptic="light"
      pressScale={0.985}
      style={[styles.resultRow, { borderBottomColor: palette.border }]}
    >
      <View style={[styles.thumb, { borderColor: palette.border, backgroundColor: palette.input }]}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.thumbImage} />
        ) : (
          <Ionicons name={kindIcon(item.kind)} size={20} color={palette.muted} />
        )}
      </View>
      <View style={styles.resultCopy}>
        <Text style={[styles.resultTitle, { color: palette.text }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.resultSubtitle, { color: palette.muted }]} numberOfLines={1}>
          {item.subtitle}
        </Text>
        {item.detail ? (
          <Text style={[styles.resultDetail, { color: palette.subtle }]} numberOfLines={2}>
            {item.detail}
          </Text>
        ) : null}
      </View>
      <View style={[styles.kindPill, { borderColor: palette.border }]}>
        <Text style={[styles.kindPillText, { color: palette.subtle }]}>{kindLabel(item.kind)}</Text>
      </View>
    </ApplePressable>
  );

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
          <BlurView intensity={isDark ? 48 : 36} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        </Pressable>

        <View
          style={[
            styles.panel,
            {
              marginTop: insets.top + 12,
              backgroundColor: palette.card,
              borderColor: palette.border,
              shadowColor: isDark ? '#000' : '#0F172A',
            },
          ]}
        >
          <View style={[styles.searchRow, { borderBottomColor: palette.border, backgroundColor: palette.input }]}>
            <EosSpotlightLensButton active={loading || visible} size={36} />
            <TextInput
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              placeholder="ID, miasto, dzielnica, agent, słowo z opisu…"
              placeholderTextColor={palette.subtle}
              style={[styles.input, { color: palette.text }]}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={palette.muted} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.resultsScroll}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {loading ? (
              <View style={styles.skeletonWrap}>
                <SkeletonBlock isDark={isDark} />
                <SkeletonBlock isDark={isDark} />
                <SkeletonBlock isDark={isDark} />
                <SkeletonBlock isDark={isDark} />
              </View>
            ) : !query.trim() && recent.length ? (
              <View style={styles.sectionWrap}>
                <Text style={[styles.sectionLabel, { color: palette.subtle }]}>Ostatnie</Text>
                {recent.map((item) => (
                  <ApplePressable
                    key={`${item.query}-${item.at}`}
                    onPress={() => setQuery(item.query)}
                    haptic="light"
                    style={[styles.recentRow, { borderBottomColor: palette.border }]}
                  >
                    <Ionicons name="time-outline" size={16} color={palette.muted} />
                    <Text style={[styles.recentText, { color: palette.text }]} numberOfLines={1}>
                      {item.query}
                    </Text>
                  </ApplePressable>
                ))}
              </View>
            ) : results.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={[styles.emptyText, { color: palette.muted }]}>
                  {query.trim()
                    ? 'Brak trafień. Spróbuj numer oferty, dzielnicę, agenta albo słowo z opisu (np. piekarnia, balkon).'
                    : 'Wpisz numer oferty, miasto, dzielnicę lub frazę z opisu.'}
                </Text>
              </View>
            ) : sections.length ? (
              sections.map((section) => (
                <View key={section.kind} style={styles.sectionWrap}>
                  <Text style={[styles.sectionLabel, { color: palette.subtle }]}>{section.label}</Text>
                  {section.items.map((item) => renderResult(item))}
                </View>
              ))
            ) : (
              results.map((item) => renderResult(item))
            )}
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: palette.border }]}>
            <Text style={[styles.footerText, { color: palette.subtle }]}>Tap — otwórz · Przesuń — zamknij klawiaturę</Text>
            {loading ? <ActivityIndicator size="small" color="#10B981" /> : tookMs > 0 ? (
              <Text style={[styles.footerText, { color: palette.subtle }]}>{tookMs} ms</Text>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 14,
  },
  panel: {
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    maxHeight: '78%',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.18,
    shadowRadius: 40,
    elevation: 16,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    paddingVertical: 0,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  resultsScroll: {
    maxHeight: 420,
  },
  sectionWrap: {
    paddingTop: 4,
  },
  sectionLabel: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  resultCopy: {
    flex: 1,
    minWidth: 0,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  resultSubtitle: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '500',
  },
  resultDetail: {
    marginTop: 4,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '400',
  },
  kindPill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  kindPillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  recentText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  emptyWrap: {
    paddingHorizontal: 22,
    paddingVertical: 28,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerText: {
    fontSize: 10,
    fontWeight: '600',
  },
  skeletonWrap: {
    paddingVertical: 6,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  skeletonThumb: {
    width: 48,
    height: 48,
    borderRadius: 16,
  },
  skeletonLine: {
    height: 10,
    borderRadius: 6,
  },
});

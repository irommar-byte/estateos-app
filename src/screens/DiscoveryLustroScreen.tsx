import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Compass, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react-native';
import ApplePressable from '../components/ApplePressable';
import DiscoveryScreenChrome from '../components/discovery/DiscoveryScreenChrome';
import {
  discoveryCard,
  discoveryTheme,
  type DiscoveryTheme,
} from '../components/discovery/discoveryTheme';
import { useDiscoveryProfile } from '../hooks/useDiscoveryProfile';
import {
  discoveryDisplayLabel,
  discoveryEventLabel,
  discoveryReasonLabel,
} from '../lib/discovery/displayLabels';
import { useAuthStore } from '../store/useAuthStore';
import { useIsDarkTheme } from '../store/useThemeStore';

function eventMeta(type: string) {
  switch (type) {
    case 'DISCOVERY_LIKE':
    case 'LIKE':
      return { label: discoveryEventLabel(type) || 'Pasuje', Icon: ThumbsUp, tone: '#34D399' };
    case 'DISCOVERY_DISLIKE':
    case 'DISLIKE':
      return { label: discoveryEventLabel(type) || 'Nie dla mnie', Icon: ThumbsDown, tone: '#FB7185' };
    case 'DISCOVERY_PRIORITY':
    case 'SERIOUS':
      return { label: discoveryEventLabel(type) || 'Na poważnie', Icon: Sparkles, tone: '#F59E0B' };
    case 'DISCOVERY_DEPTH_OPEN':
    case 'OPEN':
      return { label: discoveryEventLabel(type) || 'Otwarto', Icon: Compass, tone: '#38BDF8' };
    default:
      return {
        label: discoveryDisplayLabel(type.replace(/^DISCOVERY_/, '')),
        Icon: Compass,
        tone: '#94A3B8',
      };
  }
}

function formatMoney(n: number | null) {
  if (n == null || !Number.isFinite(n)) return null;
  return `${Math.round(n).toLocaleString('pl-PL')} PLN`;
}

function goBackOrDirection(navigation: any) {
  if (navigation?.canGoBack?.()) {
    navigation.goBack();
    return;
  }
  navigation?.navigate?.('DiscoveryDirection');
}

function InsightBlock({
  title,
  items,
  theme,
}: {
  title: string;
  items: Array<{ key: string; value: number }>;
  theme: DiscoveryTheme;
}) {
  return (
    <View style={[styles.insight, discoveryCard(theme)]}>
      <Text style={[styles.insightTitle, { color: theme.textMuted }]}>{title}</Text>
      {items.length === 0 ? (
        <Text style={[styles.muted, { color: theme.textMuted }]}>—</Text>
      ) : (
        items.slice(0, 4).map((item) => (
          <View key={item.key} style={styles.insightRow}>
            <Text style={[styles.insightKey, { color: theme.text }]} numberOfLines={1}>
              {discoveryDisplayLabel(item.key)}
            </Text>
            <Text style={[styles.insightVal, { color: theme.textMuted }]}>{item.value}</Text>
          </View>
        ))
      )}
    </View>
  );
}

/** Deep preference mirror — analytics only, calm Intelligence UI. */
export default function DiscoveryLustroScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const isDark = useIsDarkTheme();
  const theme = useMemo(() => discoveryTheme(isDark), [isDark]);
  const token = useAuthStore((s) => s.token);
  const [toast, setToast] = useState<string | null>(null);

  const onNewDecision = useCallback((eventType: string) => {
    const meta = eventMeta(eventType);
    setToast(`Zapisano: ${meta.label}`);
    setTimeout(() => setToast(null), 2200);
  }, []);

  const { auth, profile, tropes, recent, refreshing, error, reload } = useDiscoveryProfile({
    onNewDecision,
  });

  const decisions = useMemo(() => {
    if (!profile) return 0;
    return profile.likesCount + profile.dislikesCount + profile.fastTrackCount;
  }, [profile]);

  if (auth === 'loading') {
    return (
      <View style={[styles.root, { backgroundColor: theme.bg }, styles.center]}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (auth === 'guest' || !token) {
    return (
      <View
        style={[
          styles.root,
          {
            backgroundColor: theme.bg,
            paddingTop: insets.top + 12,
            paddingHorizontal: 18,
            paddingBottom: insets.bottom + 24,
          },
        ]}
      >
        <DiscoveryScreenChrome theme={theme} onBack={() => goBackOrDirection(navigation)} />
        <Text style={[styles.eyebrow, { color: theme.eyebrow }]}>EstateOS™</Text>
        <Text style={[styles.h1, { color: theme.text }]}>Lustro preferencji</Text>
        <Text style={[styles.lead, { color: theme.textMuted }]}>
          Zaloguj się, aby zobaczyć głęboką analizę gustu zbudowaną z Twoich cichych decyzji.
        </Text>
        <ApplePressable
          style={[styles.primary, { backgroundColor: theme.primaryBtn, flex: undefined }]}
          onPress={() => navigation?.navigate?.('Login')}
          haptic="medium"
        >
          <Text style={[styles.primaryText, { color: theme.primaryBtnText }]}>Zaloguj się</Text>
        </ApplePressable>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      {toast ? (
        <View
          style={[
            styles.toast,
            {
              top: insets.top + 10,
              backgroundColor: theme.toastBg,
              borderColor: theme.toastBorder,
            },
          ]}
        >
          <Text style={[styles.toastText, { color: theme.toastText }]}>{toast}</Text>
        </View>
      ) : null}
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 10,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 18,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void reload({ force: true })}
            tintColor={theme.accent}
          />
        }
      >
        <DiscoveryScreenChrome
          theme={theme}
          onBack={() => goBackOrDirection(navigation)}
          right={
            <ApplePressable
              style={[
                styles.refreshBtnCompact,
                { backgroundColor: theme.navBtnBg, borderColor: theme.navBtnBorder },
              ]}
              onPress={() => void reload({ force: true })}
              haptic="selection"
              accessibilityLabel="Odśwież"
            >
              <Ionicons name="refresh" size={16} color={theme.navBtnIcon} />
            </ApplePressable>
          }
        />

        <Text style={[styles.eyebrow, { color: theme.eyebrow }]}>EstateOS™ Intelligence</Text>
        <Text style={[styles.h1, { color: theme.text }]}>Lustro preferencji</Text>
        <Text style={[styles.lead, { color: theme.textMuted }]}>
          {profile?.summaryLine && !profile.summaryLine.includes('Za mało')
            ? profile.summaryLine
            : 'Głęboka analiza gustu — aktualizuje się po każdej decyzji.'}
        </Text>

        <View style={styles.ctaRow}>
          <ApplePressable
            style={[styles.primary, { backgroundColor: theme.primaryBtn }]}
            onPress={() => navigation.navigate('MainTabs', { screen: 'Market' })}
            haptic="medium"
          >
            <Text style={[styles.primaryText, { color: theme.primaryBtnText }]}>Oceń oferty</Text>
          </ApplePressable>
          <ApplePressable
            style={[
              styles.refreshBtn,
              { backgroundColor: theme.navBtnBg, borderColor: theme.navBtnBorder },
            ]}
            onPress={() => navigation.navigate('DiscoveryDirection')}
            haptic="selection"
            accessibilityLabel="Mój kierunek"
          >
            <Text style={[styles.directionBtnText, { color: theme.navBtnIcon }]}>Kierunek</Text>
          </ApplePressable>
        </View>

        {error ? (
          <View
            style={[
              styles.errorBox,
              { backgroundColor: theme.dangerBg, borderColor: theme.dangerBorder },
            ]}
          >
            <Text style={[styles.errorText, { color: theme.dangerText }]}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.statsGrid}>
          {[
            { label: 'Pasuje', value: profile?.likesCount ?? 0 },
            { label: 'Nie dla mnie', value: profile?.dislikesCount ?? 0 },
            { label: 'Na poważnie', value: profile?.fastTrackCount ?? 0 },
            { label: 'Otwarcia', value: profile?.opensCount ?? 0 },
          ].map((stat) => (
            <View key={stat.label} style={[styles.stat, discoveryCard(theme)]}>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>{stat.label}</Text>
              <Text style={[styles.statValue, { color: theme.text }]}>{stat.value}</Text>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: theme.text }]}>Co EstateOS już wie</Text>
        <Text style={[styles.sectionSub, { color: theme.textMuted }]}>
          {decisions === 0 ? 'Start — pierwsze decyzje tu zaskoczą.' : 'Sygnały z Twoich ocen.'}
        </Text>
        <View style={styles.insightGrid}>
          <InsightBlock theme={theme} title="Miasta" items={profile?.topCities || []} />
          <InsightBlock theme={theme} title="Dzielnice" items={profile?.topDistricts || []} />
          <InsightBlock theme={theme} title="Typ" items={profile?.topPropertyTypes || []} />
        </View>

        {(profile?.dislikeReasons?.length || 0) > 0 ? (
          <View style={{ marginTop: 14 }}>
            <Text style={[styles.chipLabel, { color: theme.textMuted }]}>Powody „nie dla mnie”</Text>
            <View style={styles.chipRow}>
              {profile!.dislikeReasons.map((r) => (
                <View
                  key={r.key}
                  style={[
                    styles.reasonChip,
                    { backgroundColor: theme.dangerBg, borderColor: theme.dangerBorder },
                  ]}
                >
                  <Text style={[styles.reasonChipText, { color: theme.dangerText }]}>
                    {discoveryReasonLabel(r.key) || discoveryDisplayLabel(r.key)} · {r.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.chipRow}>
          {formatMoney(profile?.preferredBudgetPln ?? null) ? (
            <View
              style={[
                styles.pill,
                { backgroundColor: theme.pillBg, borderColor: theme.pillBorder },
              ]}
            >
              <Text style={[styles.pillText, { color: theme.textMuted }]}>
                Budżet ~{formatMoney(profile?.preferredBudgetPln ?? null)}
              </Text>
            </View>
          ) : null}
          {profile?.preferredAreaM2 ? (
            <View
              style={[
                styles.pill,
                { backgroundColor: theme.pillBg, borderColor: theme.pillBorder },
              ]}
            >
              <Text style={[styles.pillText, { color: theme.textMuted }]}>
                ~{profile.preferredAreaM2} m²
              </Text>
            </View>
          ) : null}
          {profile?.preferredTransaction ? (
            <View
              style={[
                styles.pill,
                { backgroundColor: theme.pillBg, borderColor: theme.pillBorder },
              ]}
            >
              <Text style={[styles.pillText, { color: theme.textMuted }]}>
                {profile.preferredTransaction === 'SELL'
                  ? 'Sprzedaż'
                  : profile.preferredTransaction === 'RENT'
                    ? 'Wynajem'
                    : 'Mieszane'}
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 28 }]}>
          Ostatnie decyzje
        </Text>
        <Text style={[styles.sectionSub, { color: theme.textMuted }]}>Najnowsze na górze.</Text>
        {recent.length === 0 ? (
          <View
            style={[
              styles.emptyBox,
              { borderColor: theme.cardBorder },
            ]}
          >
            <Text style={[styles.muted, { color: theme.textMuted }]}>
              Brak decyzji. Oceń oferty w katalogu.
            </Text>
          </View>
        ) : (
          recent.map((ev) => {
            const meta = eventMeta(ev.eventType);
            const Icon = meta.Icon;
            const reason = ev.reasonCode
              ? discoveryReasonLabel(ev.reasonCode) || discoveryDisplayLabel(ev.reasonCode)
              : null;
            return (
              <ApplePressable
                key={ev.id}
                style={[styles.eventRow, discoveryCard(theme)]}
                haptic="none"
                onPress={() => {
                  if (ev.offer?.id) navigation.navigate('OfferDetail', { offerId: ev.offer.id });
                  else navigation.navigate('MainTabs', { screen: 'Market' });
                }}
              >
                <View style={[styles.thumb, { backgroundColor: theme.track }]}>
                  {ev.offer?.imageUrl ? (
                    <Image source={{ uri: ev.offer.imageUrl }} style={styles.thumbImg} />
                  ) : (
                    <Icon size={18} color={theme.textMuted} />
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.eventType, { color: meta.tone }]}>
                    {meta.label}
                    {reason ? ` · ${reason}` : ''}
                  </Text>
                  <Text style={[styles.eventTitle, { color: theme.text }]} numberOfLines={1}>
                    {ev.offer?.title || 'Oferta'}
                  </Text>
                  <Text style={[styles.eventMeta, { color: theme.textMuted }]} numberOfLines={1}>
                    {[ev.offer?.city, new Date(ev.at).toLocaleString('pl-PL')]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
              </ApplePressable>
            );
          })
        )}

        {tropes.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 28 }]}>
              Tropy na poważnie
            </Text>
            {tropes.map((t) => (
              <ApplePressable
                key={`${t.offerId}-${t.updatedAt}`}
                style={[
                  styles.tropeRow,
                  {
                    backgroundColor: isDark ? 'rgba(251,191,36,0.08)' : 'rgba(245,158,11,0.1)',
                    borderColor: isDark ? 'rgba(251,191,36,0.3)' : 'rgba(217,119,6,0.28)',
                  },
                ]}
                haptic="none"
                onPress={() => navigation.navigate('OfferDetail', { offerId: t.offerId })}
              >
                <View style={[styles.thumb, { backgroundColor: theme.track }]}>
                  {t.offer?.imageUrl ? (
                    <Image source={{ uri: t.offer.imageUrl }} style={styles.thumbImg} />
                  ) : null}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.tropeBadge, { color: isDark ? '#FCD34D' : '#B45309' }]}>
                    {t.priority || t.status === 'SERIOUS'
                      ? 'Na poważnie'
                      : discoveryDisplayLabel(t.status)}
                  </Text>
                  <Text style={[styles.eventTitle, { color: theme.text }]} numberOfLines={1}>
                    {t.offer?.title || `Oferta #${t.offerId}`}
                  </Text>
                </View>
              </ApplePressable>
            ))}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 20,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  toastText: { fontSize: 13, fontWeight: '700' },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  h1: {
    marginTop: 10,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  lead: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
  },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
  primary: {
    flex: 1,
    height: 48,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontSize: 13, fontWeight: '800' },
  refreshBtn: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshBtnCompact: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  directionBtnText: { fontSize: 13, fontWeight: '800' },
  errorBox: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
  errorText: { fontSize: 13 },
  statsGrid: {
    marginTop: 22,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stat: {
    width: '48%',
    minHeight: 76,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  statValue: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  sectionTitle: {
    marginTop: 28,
    fontSize: 18,
    fontWeight: '700',
  },
  sectionSub: {
    marginTop: 4,
    fontSize: 13,
  },
  insightGrid: { marginTop: 12, gap: 10 },
  insight: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  insightTitle: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  insightRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  insightKey: { flex: 1, fontSize: 13, fontWeight: '600' },
  insightVal: { fontVariant: ['tabular-nums'] },
  muted: { marginTop: 10, fontSize: 13 },
  chipLabel: {
    marginBottom: 8,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  reasonChip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  reasonChipText: { fontSize: 13 },
  pill: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pillText: { fontSize: 13 },
  emptyBox: {
    marginTop: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
  },
  eventRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImg: { width: '100%', height: '100%' },
  eventType: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  eventTitle: { marginTop: 2, fontSize: 14, fontWeight: '700' },
  eventMeta: { marginTop: 2, fontSize: 12 },
  tropeRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
  },
  tropeBadge: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});

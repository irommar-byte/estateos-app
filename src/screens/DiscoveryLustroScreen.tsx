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
import { DISCOVERY_COLORS } from '../components/discovery/discoveryMotion';
import { useDiscoveryProfile } from '../hooks/useDiscoveryProfile';
import {
  discoveryDisplayLabel,
  discoveryEventLabel,
  discoveryReasonLabel,
} from '../lib/discovery/displayLabels';
import { useAuthStore } from '../store/useAuthStore';

function eventMeta(type: string) {
  switch (type) {
    case 'DISCOVERY_LIKE':
    case 'LIKE':
      return { label: discoveryEventLabel(type) || 'Pasuje', Icon: ThumbsUp, tone: '#34D399' };
    case 'DISCOVERY_DISLIKE':
    case 'DISLIKE':
      return { label: discoveryEventLabel(type) || 'Nie dla mnie', Icon: ThumbsDown, tone: '#FDA4AF' };
    case 'DISCOVERY_PRIORITY':
    case 'SERIOUS':
      return { label: discoveryEventLabel(type) || 'Na poważnie', Icon: Sparkles, tone: '#FCD34D' };
    case 'DISCOVERY_DEPTH_OPEN':
    case 'OPEN':
      return { label: discoveryEventLabel(type) || 'Otwarto', Icon: Compass, tone: '#7DD3FC' };
    default:
      return {
        label: discoveryDisplayLabel(type.replace(/^DISCOVERY_/, '')),
        Icon: Compass,
        tone: 'rgba(255,255,255,0.6)',
      };
  }
}

function formatMoney(n: number | null) {
  if (n == null || !Number.isFinite(n)) return null;
  return `${Math.round(n).toLocaleString('pl-PL')} PLN`;
}

function InsightBlock({
  title,
  items,
}: {
  title: string;
  items: Array<{ key: string; value: number }>;
}) {
  return (
    <View style={styles.insight}>
      <Text style={styles.insightTitle}>{title}</Text>
      {items.length === 0 ? (
        <Text style={styles.muted}>—</Text>
      ) : (
        items.slice(0, 4).map((item) => (
          <View key={item.key} style={styles.insightRow}>
            <Text style={styles.insightKey} numberOfLines={1}>
              {discoveryDisplayLabel(item.key)}
            </Text>
            <Text style={styles.insightVal}>{item.value}</Text>
          </View>
        ))
      )}
    </View>
  );
}

/** Deep preference mirror — analytics only, Apple Intelligence calm. */
export default function DiscoveryLustroScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
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
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={DISCOVERY_COLORS.gold} />
      </View>
    );
  }

  if (auth === 'guest' || !token) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 48, paddingHorizontal: 24 }]}>
        <Text style={styles.eyebrow}>EstateOS™</Text>
        <Text style={styles.h1}>Lustro preferencji</Text>
        <Text style={styles.lead}>
          Zaloguj się, aby zobaczyć głęboką analizę gustu zbudowaną z Twoich cichych decyzji.
        </Text>
        <ApplePressable
          style={styles.primary}
          onPress={() => navigation?.navigate?.('Login')}
          haptic="medium"
        >
          <Text style={styles.primaryText}>Zaloguj się</Text>
        </ApplePressable>
        <ApplePressable style={styles.back} onPress={() => navigation?.goBack?.()} haptic="none">
          <Text style={styles.backText}>Wróć</Text>
        </ApplePressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {toast ? (
        <View style={[styles.toast, { top: insets.top + 10 }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 18,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void reload({ force: true })}
            tintColor={DISCOVERY_COLORS.gold}
          />
        }
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.eyebrow}>EstateOS™ Intelligence</Text>
            <Text style={styles.h1}>Lustro preferencji</Text>
            <Text style={styles.lead}>
              {profile?.summaryLine && !profile.summaryLine.includes('Za mało')
                ? profile.summaryLine
                : 'Głęboka analiza gustu — aktualizuje się po każdej decyzji.'}
            </Text>
            <ApplePressable
              style={styles.linkBtn}
              onPress={() => navigation.navigate('DiscoveryDirection')}
              haptic="none"
            >
              <Text style={styles.link}>← Wróć do kierunku</Text>
            </ApplePressable>
          </View>
        </View>

        <View style={styles.ctaRow}>
          <ApplePressable
            style={styles.primary}
            onPress={() => navigation.navigate('MainTabs', { screen: 'Market' })}
            haptic="medium"
          >
            <Text style={styles.primaryText}>Oceń oferty</Text>
          </ApplePressable>
          <ApplePressable
            style={styles.refreshBtn}
            onPress={() => void reload({ force: true })}
            haptic="selection"
            accessibilityLabel="Odśwież"
          >
            <Ionicons name="refresh" size={18} color="rgba(245,245,247,0.7)" />
          </ApplePressable>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.statsGrid}>
          {[
            { label: 'Pasuje', value: profile?.likesCount ?? 0 },
            { label: 'Nie dla mnie', value: profile?.dislikesCount ?? 0 },
            { label: 'Na poważnie', value: profile?.fastTrackCount ?? 0 },
            { label: 'Otwarcia', value: profile?.opensCount ?? 0 },
          ].map((stat) => (
            <View key={stat.label} style={styles.stat}>
              <Text style={styles.statLabel}>{stat.label}</Text>
              <Text style={styles.statValue}>{stat.value}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Co EstateOS już wie</Text>
        <Text style={styles.sectionSub}>
          {decisions === 0 ? 'Start — pierwsze decyzje tu zaskoczą.' : 'Sygnały z Twoich ocen.'}
        </Text>
        <View style={styles.insightGrid}>
          <InsightBlock title="Miasta" items={profile?.topCities || []} />
          <InsightBlock title="Dzielnice" items={profile?.topDistricts || []} />
          <InsightBlock title="Typ" items={profile?.topPropertyTypes || []} />
        </View>

        {(profile?.dislikeReasons?.length || 0) > 0 ? (
          <View style={{ marginTop: 14 }}>
            <Text style={styles.chipLabel}>Powody „nie dla mnie”</Text>
            <View style={styles.chipRow}>
              {profile!.dislikeReasons.map((r) => (
                <View key={r.key} style={styles.reasonChip}>
                  <Text style={styles.reasonChipText}>
                    {discoveryReasonLabel(r.key) || discoveryDisplayLabel(r.key)} · {r.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.chipRow}>
          {formatMoney(profile?.preferredBudgetPln ?? null) ? (
            <View style={styles.pill}>
              <Text style={styles.pillText}>Budżet ~{formatMoney(profile?.preferredBudgetPln ?? null)}</Text>
            </View>
          ) : null}
          {profile?.preferredAreaM2 ? (
            <View style={styles.pill}>
              <Text style={styles.pillText}>~{profile.preferredAreaM2} m²</Text>
            </View>
          ) : null}
          {profile?.preferredTransaction ? (
            <View style={styles.pill}>
              <Text style={styles.pillText}>
                {profile.preferredTransaction === 'SELL'
                  ? 'Sprzedaż'
                  : profile.preferredTransaction === 'RENT'
                    ? 'Wynajem'
                    : 'Mieszane'}
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Ostatnie decyzje</Text>
        <Text style={styles.sectionSub}>Najnowsze na górze.</Text>
        {recent.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.muted}>Brak decyzji. Oceń oferty w katalogu.</Text>
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
                style={styles.eventRow}
                haptic="none"
                onPress={() => {
                  if (ev.offer?.id) navigation.navigate('OfferDetail', { offerId: ev.offer.id });
                  else navigation.navigate('MainTabs', { screen: 'Market' });
                }}
              >
                <View style={styles.thumb}>
                  {ev.offer?.imageUrl ? (
                    <Image source={{ uri: ev.offer.imageUrl }} style={styles.thumbImg} />
                  ) : (
                    <Icon size={18} color="rgba(255,255,255,0.35)" />
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.eventType, { color: meta.tone }]}>
                    {meta.label}
                    {reason ? ` · ${reason}` : ''}
                  </Text>
                  <Text style={styles.eventTitle} numberOfLines={1}>
                    {ev.offer?.title || 'Oferta'}
                  </Text>
                  <Text style={styles.eventMeta} numberOfLines={1}>
                    {[ev.offer?.city, new Date(ev.at).toLocaleString('pl-PL')]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.35)" />
              </ApplePressable>
            );
          })
        )}

        {tropes.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Tropy na poważnie</Text>
            {tropes.map((t) => (
              <ApplePressable
                key={`${t.offerId}-${t.updatedAt}`}
                style={styles.tropeRow}
                haptic="none"
                onPress={() => navigation.navigate('OfferDetail', { offerId: t.offerId })}
              >
                <View style={styles.thumb}>
                  {t.offer?.imageUrl ? (
                    <Image source={{ uri: t.offer.imageUrl }} style={styles.thumbImg} />
                  ) : null}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.tropeBadge}>
                    {t.priority || t.status === 'SERIOUS'
                      ? 'Na poważnie'
                      : discoveryDisplayLabel(t.status)}
                  </Text>
                  <Text style={styles.eventTitle} numberOfLines={1}>
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
  root: { flex: 1, backgroundColor: '#040405' },
  center: { alignItems: 'center', justifyContent: 'center' },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 20,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(52,211,153,0.3)',
    backgroundColor: 'rgba(16,185,129,0.18)',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  toastText: { color: '#D1FAE5', fontSize: 13, fontWeight: '700' },
  eyebrow: {
    color: 'rgba(251,191,36,0.9)',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  h1: {
    marginTop: 10,
    color: '#FFF',
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  lead: {
    marginTop: 8,
    color: DISCOVERY_COLORS.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  headerRow: { flexDirection: 'row', gap: 12 },
  linkBtn: { marginTop: 10, alignSelf: 'flex-start' },
  link: { color: '#34D399', fontSize: 14, fontWeight: '800' },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
  primary: {
    flex: 1,
    height: 48,
    borderRadius: 18,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  refreshBtn: {
    width: 48,
    height: 48,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: { marginTop: 16, alignSelf: 'flex-start', padding: 8 },
  backText: { color: DISCOVERY_COLORS.textMuted, fontWeight: '700' },
  errorBox: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(251,113,133,0.3)',
    backgroundColor: 'rgba(244,63,94,0.12)',
    padding: 12,
  },
  errorText: { color: '#FECDD3', fontSize: 13 },
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
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  statLabel: {
    color: 'rgba(245,245,247,0.5)',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  statValue: {
    marginTop: 8,
    color: '#FFF',
    fontSize: 24,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  sectionTitle: {
    marginTop: 28,
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  sectionSub: {
    marginTop: 4,
    color: DISCOVERY_COLORS.textMuted,
    fontSize: 13,
  },
  insightGrid: { marginTop: 12, gap: 10 },
  insight: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 14,
  },
  insightTitle: {
    color: 'rgba(245,245,247,0.5)',
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
  insightKey: { flex: 1, color: '#FFF', fontSize: 13, fontWeight: '600' },
  insightVal: { color: DISCOVERY_COLORS.textMuted, fontVariant: ['tabular-nums'] },
  muted: { marginTop: 10, color: DISCOVERY_COLORS.textMuted, fontSize: 13 },
  chipLabel: {
    marginBottom: 8,
    color: 'rgba(245,245,247,0.5)',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  reasonChip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(251,113,133,0.28)',
    backgroundColor: 'rgba(244,63,94,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  reasonChipText: { color: '#FFE4E6', fontSize: 13 },
  pill: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pillText: { color: DISCOVERY_COLORS.textMuted, fontSize: 13 },
  emptyBox: {
    marginTop: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.14)',
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
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 10,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.4)',
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
  eventTitle: { marginTop: 2, color: '#FFF', fontSize: 14, fontWeight: '700' },
  eventMeta: { marginTop: 2, color: DISCOVERY_COLORS.textMuted, fontSize: 12 },
  tropeRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(251,191,36,0.28)',
    backgroundColor: 'rgba(251,191,36,0.07)',
    padding: 10,
  },
  tropeBadge: {
    color: '#FCD34D',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});

import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Brain, Check } from 'lucide-react-native';
import ApplePressable from '../components/ApplePressable';
import DiscoveryScreenChrome from '../components/discovery/DiscoveryScreenChrome';
import { discoveryCard, discoveryTheme } from '../components/discovery/discoveryTheme';
import { useDiscoveryProfile } from '../hooks/useDiscoveryProfile';
import { discoveryDisplayLabel, discoveryPropertyTypeLabel } from '../lib/discovery/displayLabels';
import { navigateDiscoveryHref } from '../lib/discovery/navigateDiscoveryHref';
import { useAuthStore } from '../store/useAuthStore';
import { useIsDarkTheme } from '../store/useThemeStore';

type StageKey = 'EXPLORE' | 'FOCUS' | 'READY' | 'COMPLETE';

const STAGES: Array<{
  key: Exclude<StageKey, 'COMPLETE'>;
  label: string;
  meaning: string;
  youAreHere: string;
}> = [
  {
    key: 'EXPLORE',
    label: 'Odkrywanie',
    meaning: 'Oceń oferty (pasuje / nie dla mnie). Intelligence dopiero poznaje Twój gust.',
    youAreHere: 'Zbieramy pierwsze sygnały — bez formularza, tylko z Twoich ocen.',
  },
  {
    key: 'FOCUS',
    label: 'Fokus',
    meaning: 'Kierunek się zarysowuje. Kolejne oceny coraz wyraźniej ostrzą profil.',
    youAreHere: 'Już widać preferencje. Kilka spokojnych decyzji jeszcze bardziej je wyostrzy.',
  },
  {
    key: 'READY',
    label: 'Gotowość',
    meaning: 'Profil jest wystarczająco wyraźny, by doprecyzować wybór albo iść „na poważnie”.',
    youAreHere: 'Intelligence dobrze Cię czyta — czas zawęzić oferty albo oznaczyć trop.',
  },
];

function eventToastLabel(type: string) {
  switch (type) {
    case 'DISCOVERY_LIKE':
    case 'LIKE':
      return 'Pasuje';
    case 'DISCOVERY_DISLIKE':
    case 'DISLIKE':
      return 'Nie dla mnie';
    case 'DISCOVERY_PRIORITY':
    case 'SERIOUS':
      return 'Na poważnie';
    default:
      return 'Zapisano';
  }
}

function confidencePlain(c: number) {
  if (c < 0.12) return 'Dopiero zaczynamy';
  if (c < 0.35) return 'Pierwszy zarys';
  if (c < 0.6) return 'Wyraźny kierunek';
  return 'Dobrze Cię rozumiemy';
}

function formatPln(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  return `~${Math.round(n).toLocaleString('pl-PL')} zł`;
}

function transactionLabel(tx: string | null | undefined) {
  const t = String(tx || '').toUpperCase();
  if (t === 'SELL' || t === 'SALE') return 'Sprzedaż';
  if (t === 'RENT') return 'Wynajem';
  if (t === 'MIXED') return 'Sprzedaż i wynajem';
  return null;
}

function resolveStage(key: string | undefined): StageKey {
  const k = String(key || 'EXPLORE').toUpperCase();
  if (k === 'FOCUS' || k === 'READY' || k === 'COMPLETE' || k === 'EXPLORE') return k;
  return 'EXPLORE';
}

function humanTip(body: string | undefined, summaryLine: string | undefined) {
  const raw = String(body || '').trim();
  if (!raw) return 'Oceń kilka ofert — kierunek ułoży się sam.';
  const summary = String(summaryLine || '').trim();
  if (summary && raw.startsWith(summary)) {
    const rest = raw.slice(summary.length).replace(/^[\s.·—–-]+/, '').trim();
    return rest || 'Czas doprecyzować wybór albo oznaczyć coś „na poważnie”.';
  }
  if (summary && raw.includes(summary)) {
    return raw.replace(summary, '').replace(/^[\s.·—–-]+/, '').trim() || raw;
  }
  return raw;
}

function goBackOrMarket(navigation: any) {
  if (navigation?.canGoBack?.()) {
    navigation.goBack();
    return;
  }
  navigation?.navigate?.('MainTabs', { screen: 'Market' });
}

/** EstateOS™ Intelligence — clear journey + what we already know about you. */
export default function DiscoveryDirectionScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const isDark = useIsDarkTheme();
  const theme = useMemo(() => discoveryTheme(isDark), [isDark]);
  const token = useAuthStore((s) => s.token);
  const [toast, setToast] = useState<string | null>(null);

  const onNewDecision = useCallback((eventType: string) => {
    setToast(`Zapisano: ${eventToastLabel(eventType)}`);
    setTimeout(() => setToast(null), 2200);
  }, []);

  const { auth, profile, guide, refreshing, error } = useDiscoveryProfile({ onNewDecision });

  const activeStage = resolveStage(guide?.intentStage);
  const stageIndex =
    activeStage === 'COMPLETE'
      ? 2
      : Math.max(
          0,
          STAGES.findIndex((s) => s.key === activeStage),
        );
  const activeMeta = STAGES[Math.min(stageIndex, STAGES.length - 1)];
  const confPct = Math.round(Math.min(1, Math.max(0, profile?.confidence ?? 0)) * 100);
  const title =
    activeStage === 'COMPLETE'
      ? 'Ta faza poszukiwania jest domknięta.'
      : guide?.nextStep?.title || 'Zacznijmy od tego, co jest dla Ciebie ważne.';
  const tip = humanTip(guide?.body, profile?.summaryLine);
  const primary = guide?.primaryCta || { label: 'Oceń oferty', href: '/oferty' };

  const knownChips = useMemo(() => {
    const chips: Array<{ label: string; value: string }> = [];
    const city = profile?.topCities?.[0]?.key;
    if (city) chips.push({ label: 'Miasto', value: city });
    const district = profile?.topDistricts?.[0]?.key;
    if (district) chips.push({ label: 'Okolica', value: district });
    const propRaw = profile?.topPropertyTypes?.[0]?.key;
    if (propRaw) {
      const prop =
        discoveryPropertyTypeLabel(propRaw) || discoveryDisplayLabel(propRaw) || String(propRaw);
      chips.push({ label: 'Typ', value: prop });
    }
    const budget = formatPln(profile?.preferredBudgetPln);
    if (budget) chips.push({ label: 'Budżet', value: budget });
    if (profile?.preferredAreaM2 && profile.preferredAreaM2 > 0) {
      chips.push({ label: 'Metraż', value: `~${Math.round(profile.preferredAreaM2)} m²` });
    }
    const tx = transactionLabel(profile?.preferredTransaction);
    if (tx) chips.push({ label: 'Transakcja', value: tx });
    return chips;
  }, [profile]);

  const decisions =
    (profile?.likesCount || 0) + (profile?.dislikesCount || 0) + (profile?.fastTrackCount || 0);

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
        <DiscoveryScreenChrome theme={theme} onBack={() => goBackOrMarket(navigation)} />
        <Text style={[styles.eyebrow, { color: theme.eyebrow }]}>EstateOS™ Intelligence</Text>
        <Text style={[styles.h1, { color: theme.text }]}>Mój kierunek</Text>
        <Text style={[styles.lead, { color: theme.textMuted }]}>
          Tu zobaczysz, na jakim etapie jesteś i co Intelligence już o Tobie wie — po zalogowaniu.
        </Text>
        <ApplePressable
          style={[styles.primary, { backgroundColor: theme.primaryBtn }]}
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
      >
        <DiscoveryScreenChrome theme={theme} onBack={() => goBackOrMarket(navigation)} />

        <View style={styles.headBrand}>
          <View
            style={[
              styles.brainOrb,
              { backgroundColor: theme.brainOrbBg, borderColor: theme.brainOrbBorder },
            ]}
          >
            <Brain size={18} color={theme.brainOrbIcon} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.eyebrow, { color: theme.eyebrow }]}>EstateOS™ Intelligence</Text>
            <Text style={[styles.headSub, { color: theme.textMuted }]}>
              {refreshing ? 'Aktualizacja…' : 'Twój spokojny przewodnik po decyzji'}
            </Text>
          </View>
        </View>

        <Text style={[styles.h1, { color: theme.text }]}>Mój kierunek</Text>
        <Text style={[styles.lead, { color: theme.textMuted }]}>
          Trzy etapy od pierwszych ocen do gotowości. Tu zawsze widać, gdzie jesteś i co robić dalej.
        </Text>

        <View
          style={[styles.journeyCard, discoveryCard(theme, true)]}
          accessibilityLabel="Etapy kierunku"
        >
          <Text style={[styles.sectionKicker, { color: theme.textMuted }]}>Jak to działa</Text>
          {STAGES.map((stage, idx) => {
            const done = idx < stageIndex || activeStage === 'COMPLETE';
            const current = idx === stageIndex && activeStage !== 'COMPLETE';
            return (
              <View
                key={stage.key}
                style={[
                  styles.stageRow,
                  current && {
                    backgroundColor: theme.stageCurrentBg,
                    borderColor: theme.stageCurrentBorder,
                    borderWidth: StyleSheet.hairlineWidth,
                  },
                  idx < STAGES.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: theme.hairline,
                    borderRadius: 0,
                    paddingBottom: 14,
                    marginBottom: 4,
                  },
                ]}
              >
                <View
                  style={[
                    styles.stageIndex,
                    {
                      backgroundColor: theme.stageIndexBg,
                      borderColor: theme.stageIndexBorder,
                    },
                    done && { backgroundColor: theme.success, borderColor: theme.success },
                    current && {
                      backgroundColor: theme.accentSoft,
                      borderColor: theme.accent,
                    },
                  ]}
                >
                  {done ? (
                    <Check size={14} color={isDark ? '#041016' : '#FFFFFF'} strokeWidth={3} />
                  ) : (
                    <Text
                      style={[
                        styles.stageIndexText,
                        { color: current ? theme.accentText : theme.stageIndexText },
                      ]}
                    >
                      {idx + 1}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.stageTitleRow}>
                    <Text
                      style={[
                        styles.stageLabel,
                        { color: current ? theme.text : theme.textSecondary },
                      ]}
                    >
                      {stage.label}
                    </Text>
                    {current ? (
                      <View style={[styles.herePill, { backgroundColor: theme.accentSoft }]}>
                        <Text style={[styles.herePillText, { color: theme.accentText }]}>
                          Tu jesteś
                        </Text>
                      </View>
                    ) : null}
                    {done ? (
                      <Text style={[styles.doneHint, { color: theme.success }]}>za Tobą</Text>
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.stageMeaning,
                      { color: current ? theme.textSecondary : theme.textMuted },
                    ]}
                  >
                    {stage.meaning}
                  </Text>
                </View>
              </View>
            );
          })}
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

        <View style={[styles.guideCard, discoveryCard(theme)]}>
          <Text style={[styles.sectionKicker, { color: theme.textMuted }]}>Twój następny krok</Text>
          <Text style={[styles.hereLine, { color: theme.accentText }]}>{activeMeta.youAreHere}</Text>
          <Text style={[styles.guideTitle, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.guideBody, { color: theme.textSecondary }]}>{tip}</Text>

          {knownChips.length > 0 ? (
            <View style={styles.knownBlock}>
              <Text style={[styles.knownTitle, { color: theme.textSecondary }]}>
                Co Intelligence już wie
              </Text>
              <View style={styles.chipWrap}>
                {knownChips.map((chip) => (
                  <View
                    key={`${chip.label}-${chip.value}`}
                    style={[
                      styles.chip,
                      { backgroundColor: theme.chipBg, borderColor: theme.chipBorder },
                    ]}
                  >
                    <Text style={[styles.chipLabel, { color: theme.chipLabel }]}>{chip.label}</Text>
                    <Text style={[styles.chipValue, { color: theme.chipValue }]}>{chip.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.knownBlock}>
              <Text style={[styles.knownTitle, { color: theme.textSecondary }]}>
                Co Intelligence już wie
              </Text>
              <Text style={[styles.knownEmpty, { color: theme.textMuted }]}>
                Jeszcze za mało ocen — po kilku „pasuje / nie dla mnie” pojawią się tu miasto, typ i
                budżet.
              </Text>
            </View>
          )}

          <View style={styles.confBlock}>
            <View style={styles.confHead}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.confTitle, { color: theme.textSecondary }]}>
                  Na ile Cię rozumiemy
                </Text>
                <Text style={[styles.confLabel, { color: theme.textMuted }]}>
                  {confidencePlain(profile?.confidence ?? 0)}
                </Text>
              </View>
              <Text style={[styles.confPct, { color: theme.accent }]}>{confPct}%</Text>
            </View>
            <View style={[styles.confTrack, { backgroundColor: theme.track }]}>
              <View
                style={[
                  styles.confFill,
                  { width: `${Math.max(4, confPct)}%`, backgroundColor: theme.accent },
                ]}
              />
            </View>
            {decisions > 0 ? (
              <Text style={[styles.confMeta, { color: theme.textMuted }]}>
                {decisions} {decisions === 1 ? 'decyzja' : decisions < 5 ? 'decyzje' : 'decyzji'}
                {profile?.likesCount ? ` · ${profile.likesCount} pasuje` : ''}
                {profile?.dislikesCount ? ` · ${profile.dislikesCount} nie dla mnie` : ''}
              </Text>
            ) : null}
          </View>

          <ApplePressable
            style={[styles.primary, { backgroundColor: theme.primaryBtn }]}
            haptic="medium"
            onPress={() =>
              navigateDiscoveryHref(navigation, primary.href, primary.action || guide?.nextStep?.action)
            }
          >
            <Text style={[styles.primaryText, { color: theme.primaryBtnText }]}>{primary.label}</Text>
          </ApplePressable>
          <ApplePressable
            style={styles.secondary}
            haptic="none"
            onPress={() => navigation.navigate('DiscoveryLustro')}
          >
            <Text style={[styles.secondaryText, { color: theme.secondaryText }]}>
              Lustro preferencji — pełny podgląd gustu
            </Text>
          </ApplePressable>
        </View>
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
  headBrand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brainOrb: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  headSub: { marginTop: 2, fontSize: 12 },
  h1: {
    marginTop: 22,
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.8,
    lineHeight: 38,
  },
  lead: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 360,
  },
  sectionKicker: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  journeyCard: {
    marginTop: 22,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
  },
  stageRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 16,
  },
  stageIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 1,
  },
  stageIndexText: { fontSize: 12, fontWeight: '800' },
  stageTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  stageLabel: { fontSize: 15, fontWeight: '800' },
  herePill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  herePillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  doneHint: { fontSize: 11, fontWeight: '700' },
  stageMeaning: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
  },
  errorBox: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
  errorText: { fontSize: 13 },
  guideCard: {
    marginTop: 18,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 22,
  },
  hereLine: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    marginBottom: 10,
  },
  guideTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  guideBody: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
  },
  knownBlock: { marginTop: 20 },
  knownTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 10,
  },
  knownEmpty: { fontSize: 13, lineHeight: 19 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: '42%',
    flexGrow: 1,
  },
  chipLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  chipValue: {
    marginTop: 3,
    fontSize: 14,
    fontWeight: '700',
  },
  confBlock: { marginTop: 22 },
  confHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
  },
  confTitle: { fontSize: 13, fontWeight: '800' },
  confLabel: { marginTop: 3, fontSize: 12, fontWeight: '600' },
  confPct: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  confTrack: {
    marginTop: 10,
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  confFill: {
    height: '100%',
    borderRadius: 3,
  },
  confMeta: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
  },
  primary: {
    marginTop: 24,
    height: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontSize: 13, fontWeight: '800' },
  secondary: { marginTop: 10, paddingVertical: 12, alignItems: 'center' },
  secondaryText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
});

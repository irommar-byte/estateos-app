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
import { DISCOVERY_COLORS } from '../components/discovery/discoveryMotion';
import { useDiscoveryProfile } from '../hooks/useDiscoveryProfile';
import { discoveryDisplayLabel, discoveryPropertyTypeLabel } from '../lib/discovery/displayLabels';
import { navigateDiscoveryHref } from '../lib/discovery/navigateDiscoveryHref';
import { useAuthStore } from '../store/useAuthStore';

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
    meaning: 'Oceń oferty (pasuje / nie dla mnie). Inteligence dopiero poznaje Twój gust.',
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
    youAreHere: 'Inteligence dobrze Cię czyta — czas zawęzić oferty albo oznaczyć trop.',
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

/** Strip machine summary from tip when we already show preference chips. */
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

/** EstateOS™ Inteligence — clear journey + what we already know about you. */
export default function DiscoveryDirectionScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
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
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={DISCOVERY_COLORS.gold} />
      </View>
    );
  }

  if (auth === 'guest' || !token) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 48, paddingHorizontal: 24 }]}>
        <Text style={styles.eyebrow}>EstateOS™ Inteligence</Text>
        <Text style={styles.h1}>Mój kierunek</Text>
        <Text style={styles.lead}>
          Tu zobaczysz, na jakim etapie jesteś i co Inteligence już o Tobie wie — po zalogowaniu.
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
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 18,
        }}
      >
        <View style={styles.headBrand}>
          <View style={styles.brainOrb}>
            <Brain size={18} color="#7DD3FC" strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>EstateOS™ Inteligence</Text>
            <Text style={styles.headSub}>
              {refreshing ? 'Aktualizacja…' : 'Twój spokojny przewodnik po decyzji'}
            </Text>
          </View>
        </View>

        <Text style={styles.h1}>Mój kierunek</Text>
        <Text style={styles.lead}>
          Trzy etapy od pierwszych ocen do gotowości. Tu zawsze widać, gdzie jesteś i co robić dalej.
        </Text>

        <View style={styles.journeyCard} accessibilityLabel="Etapy kierunku">
          <Text style={styles.sectionKicker}>Jak to działa</Text>
          {STAGES.map((stage, idx) => {
            const done = idx < stageIndex || activeStage === 'COMPLETE';
            const current = idx === stageIndex && activeStage !== 'COMPLETE';
            return (
              <View
                key={stage.key}
                style={[
                  styles.stageRow,
                  current && styles.stageRowCurrent,
                  idx < STAGES.length - 1 && styles.stageRowGap,
                ]}
              >
                <View
                  style={[
                    styles.stageIndex,
                    done && styles.stageIndexDone,
                    current && styles.stageIndexCurrent,
                  ]}
                >
                  {done ? (
                    <Check size={14} color="#041016" strokeWidth={3} />
                  ) : (
                    <Text style={[styles.stageIndexText, current && styles.stageIndexTextCurrent]}>
                      {idx + 1}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.stageTitleRow}>
                    <Text style={[styles.stageLabel, current && styles.stageLabelCurrent]}>
                      {stage.label}
                    </Text>
                    {current ? (
                      <View style={styles.herePill}>
                        <Text style={styles.herePillText}>Tu jesteś</Text>
                      </View>
                    ) : null}
                    {done ? <Text style={styles.doneHint}>za Tobą</Text> : null}
                  </View>
                  <Text style={[styles.stageMeaning, current && styles.stageMeaningCurrent]}>
                    {stage.meaning}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.guideCard}>
          <Text style={styles.sectionKicker}>Twój następny krok</Text>
          <Text style={styles.hereLine}>{activeMeta.youAreHere}</Text>
          <Text style={styles.guideTitle}>{title}</Text>
          <Text style={styles.guideBody}>{tip}</Text>

          {knownChips.length > 0 ? (
            <View style={styles.knownBlock}>
              <Text style={styles.knownTitle}>Co Inteligence już wie</Text>
              <View style={styles.chipWrap}>
                {knownChips.map((chip) => (
                  <View key={`${chip.label}-${chip.value}`} style={styles.chip}>
                    <Text style={styles.chipLabel}>{chip.label}</Text>
                    <Text style={styles.chipValue}>{chip.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.knownBlock}>
              <Text style={styles.knownTitle}>Co Inteligence już wie</Text>
              <Text style={styles.knownEmpty}>
                Jeszcze za mało ocen — po kilku „pasuje / nie dla mnie” pojawią się tu miasto, typ i
                budżet.
              </Text>
            </View>
          )}

          <View style={styles.confBlock}>
            <View style={styles.confHead}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.confTitle}>Na ile Cię rozumiemy</Text>
                <Text style={styles.confLabel}>{confidencePlain(profile?.confidence ?? 0)}</Text>
              </View>
              <Text style={styles.confPct}>{confPct}%</Text>
            </View>
            <View style={styles.confTrack}>
              <View style={[styles.confFill, { width: `${Math.max(4, confPct)}%` }]} />
            </View>
            {decisions > 0 ? (
              <Text style={styles.confMeta}>
                {decisions} {decisions === 1 ? 'decyzja' : decisions < 5 ? 'decyzje' : 'decyzji'}
                {profile?.likesCount ? ` · ${profile.likesCount} pasuje` : ''}
                {profile?.dislikesCount ? ` · ${profile.dislikesCount} nie dla mnie` : ''}
              </Text>
            ) : null}
          </View>

          <ApplePressable
            style={styles.primary}
            haptic="medium"
            onPress={() =>
              navigateDiscoveryHref(navigation, primary.href, primary.action || guide?.nextStep?.action)
            }
          >
            <Text style={styles.primaryText}>{primary.label}</Text>
          </ApplePressable>
          <ApplePressable
            style={styles.secondary}
            haptic="none"
            onPress={() => navigation.navigate('DiscoveryLustro')}
          >
            <Text style={styles.secondaryText}>Lustro preferencji — pełny podgląd gustu</Text>
          </ApplePressable>
        </View>
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
  headBrand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brainOrb: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,189,248,0.4)',
    backgroundColor: 'rgba(56,189,248,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    color: 'rgba(125,211,252,0.95)',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  headSub: { marginTop: 2, color: DISCOVERY_COLORS.textMuted, fontSize: 12 },
  h1: {
    marginTop: 22,
    color: '#FFF',
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.8,
    lineHeight: 38,
  },
  lead: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.58)',
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 360,
  },
  sectionKicker: {
    color: 'rgba(255,255,255,0.42)',
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
    borderColor: 'rgba(56,189,248,0.22)',
    backgroundColor: 'rgba(8,14,24,0.85)',
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
  stageRowGap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    borderRadius: 0,
    paddingBottom: 14,
    marginBottom: 4,
  },
  stageRowCurrent: {
    backgroundColor: 'rgba(56,189,248,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,189,248,0.28)',
  },
  stageIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    marginTop: 1,
  },
  stageIndexDone: {
    backgroundColor: '#34D399',
    borderColor: '#34D399',
  },
  stageIndexCurrent: {
    backgroundColor: 'rgba(56,189,248,0.22)',
    borderColor: 'rgba(125,211,252,0.55)',
  },
  stageIndexText: { color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '800' },
  stageIndexTextCurrent: { color: '#E0F2FE' },
  stageTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  stageLabel: { color: 'rgba(255,255,255,0.72)', fontSize: 15, fontWeight: '800' },
  stageLabelCurrent: { color: '#FFF' },
  herePill: {
    borderRadius: 999,
    backgroundColor: 'rgba(56,189,248,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  herePillText: {
    color: '#BAE6FD',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  doneHint: { color: 'rgba(52,211,153,0.75)', fontSize: 11, fontWeight: '700' },
  stageMeaning: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.42)',
    fontSize: 13,
    lineHeight: 18,
  },
  stageMeaningCurrent: { color: 'rgba(226,232,240,0.78)' },
  errorBox: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(251,113,133,0.3)',
    backgroundColor: 'rgba(244,63,94,0.12)',
    padding: 12,
  },
  errorText: { color: '#FECDD3', fontSize: 13 },
  guideCard: {
    marginTop: 18,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(0,0,0,0.55)',
    padding: 22,
  },
  hereLine: {
    color: 'rgba(125,211,252,0.9)',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    marginBottom: 10,
  },
  guideTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  guideBody: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.62)',
    fontSize: 15,
    lineHeight: 22,
  },
  knownBlock: { marginTop: 20 },
  knownTitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 10,
  },
  knownEmpty: { color: 'rgba(255,255,255,0.45)', fontSize: 13, lineHeight: 19 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,189,248,0.22)',
    backgroundColor: 'rgba(56,189,248,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: '42%',
    flexGrow: 1,
  },
  chipLabel: {
    color: 'rgba(186,230,253,0.55)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  chipValue: {
    marginTop: 3,
    color: '#F8FAFC',
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
  confTitle: { color: 'rgba(255,255,255,0.78)', fontSize: 13, fontWeight: '800' },
  confLabel: { marginTop: 3, color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600' },
  confPct: { color: '#7DD3FC', fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  confTrack: {
    marginTop: 10,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  confFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#38BDF8',
  },
  confMeta: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '600',
  },
  primary: {
    marginTop: 24,
    height: 50,
    borderRadius: 18,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  secondary: { marginTop: 10, paddingVertical: 12, alignItems: 'center' },
  secondaryText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  back: { marginTop: 16, alignSelf: 'flex-start', padding: 8 },
  backText: { color: DISCOVERY_COLORS.textMuted, fontWeight: '700' },
});

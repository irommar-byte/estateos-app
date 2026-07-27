import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sparkles } from 'lucide-react-native';
import ApplePressable from '../components/ApplePressable';
import { DISCOVERY_COLORS } from '../components/discovery/discoveryMotion';
import { useDiscoveryProfile } from '../hooks/useDiscoveryProfile';
import { navigateDiscoveryHref } from '../lib/discovery/navigateDiscoveryHref';
import { useAuthStore } from '../store/useAuthStore';

const STAGES = [
  { key: 'EXPLORE', label: 'Odkrywanie' },
  { key: 'FOCUS', label: 'Fokus' },
  { key: 'READY', label: 'Gotowość' },
] as const;

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

function confidenceLabel(c: number) {
  if (c < 0.12) return 'Cold start';
  if (c < 0.35) return 'Zarys';
  if (c < 0.6) return 'Wyraźny kierunek';
  return 'Silny sygnał';
}

/** Apple Intelligence “For You” — one calm composition, next step only. */
export default function DiscoveryDirectionScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s) => s.token);
  const [toast, setToast] = useState<string | null>(null);

  const onNewDecision = useCallback((eventType: string) => {
    setToast(`Zapisano: ${eventToastLabel(eventType)}`);
    setTimeout(() => setToast(null), 2200);
  }, []);

  const { auth, profile, guide, refreshing, error } = useDiscoveryProfile({ onNewDecision });

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
        <Text style={styles.h1}>Mój kierunek</Text>
        <Text style={styles.lead}>
          Spokojny przewodnik po Twojej decyzji — jako EstateOS™ Inteligence, bez formularza.
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

  const activeStage = guide?.intentStage || 'EXPLORE';
  const stageIndex = Math.max(
    0,
    STAGES.findIndex((s) => s.key === activeStage),
  );
  const confPct = Math.round(Math.min(1, Math.max(0, profile?.confidence ?? 0)) * 100);
  const title = guide?.nextStep?.title || 'Zacznijmy od tego, co jest dla Ciebie ważne.';
  const body = guide?.body || 'Oceń kilka ofert — kierunek pojawi się tu sam, bez hałasu.';
  const primary = guide?.primaryCta || { label: 'Oceń oferty', href: '/oferty' };

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
          <View style={styles.sparkleOrb}>
            <Sparkles size={16} color="#FDE68A" />
          </View>
          <View>
            <Text style={styles.eyebrow}>EstateOS™ Inteligence</Text>
            <Text style={styles.headSub}>
              {refreshing ? 'Aktualizacja…' : 'Twój spokojny następny krok'}
            </Text>
          </View>
        </View>

        <Text style={styles.h1}>Mój kierunek</Text>
        <Text style={styles.lead}>Jedna myśl. Jedna sugestia. Reszta w lustrze preferencji.</Text>

        <View style={styles.stageStrip} accessibilityLabel="Faza kierunku">
          {STAGES.map((stage, idx) => {
            const active = idx === stageIndex || (activeStage === 'COMPLETE' && idx === 2);
            return (
              <View key={stage.key} style={[styles.stagePill, active && styles.stagePillActive]}>
                <Text style={[styles.stageText, active && styles.stageTextActive]}>{stage.label}</Text>
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
          <View style={styles.guideHead}>
            <Text style={styles.guideKicker}>Guide</Text>
            {guide?.intentLabel ? (
              <View style={styles.intentChip}>
                <Text style={styles.intentChipText}>{guide.intentLabel}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.guideTitle}>{title}</Text>
          <Text style={styles.guideBody}>{body}</Text>

          <View style={styles.confHead}>
            <Text style={styles.confLabel}>Pewność · {confidenceLabel(profile?.confidence ?? 0)}</Text>
            <Text style={styles.confPct}>{confPct}%</Text>
          </View>
          <View style={styles.confTrack}>
            <View style={[styles.confFill, { width: `${confPct}%` }]} />
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
            <Text style={styles.secondaryText}>Lustro preferencji</Text>
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
  sparkleOrb: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(251,191,36,0.35)',
    backgroundColor: 'rgba(251,191,36,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    color: 'rgba(251,191,36,0.9)',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  headSub: { marginTop: 2, color: DISCOVERY_COLORS.textMuted, fontSize: 12 },
  h1: {
    marginTop: 28,
    color: '#FFF',
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -0.8,
    lineHeight: 40,
  },
  lead: {
    marginTop: 10,
    color: DISCOVERY_COLORS.textMuted,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 340,
  },
  stageStrip: {
    marginTop: 22,
    flexDirection: 'row',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 4,
  },
  stagePill: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
  },
  stagePillActive: {
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(251,191,36,0.35)',
  },
  stageText: { color: DISCOVERY_COLORS.textMuted, fontSize: 11, fontWeight: '700' },
  stageTextActive: { color: '#FDE68A' },
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
    marginTop: 22,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 22,
  },
  guideHead: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  guideKicker: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  intentChip: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(251,191,36,0.3)',
    backgroundColor: 'rgba(251,191,36,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  intentChipText: {
    color: '#FDE68A',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  guideTitle: {
    marginTop: 14,
    color: '#FFF',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
    lineHeight: 30,
  },
  guideBody: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    lineHeight: 22,
  },
  confHead: {
    marginTop: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
  },
  confLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700' },
  confPct: { color: '#FDE68A', fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  confTrack: {
    marginTop: 8,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  confFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#FBBF24',
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
  secondaryText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '800' },
  back: { marginTop: 16, alignSelf: 'flex-start', padding: 8 },
  backText: { color: DISCOVERY_COLORS.textMuted, fontWeight: '700' },
});

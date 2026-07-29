import React, { useEffect, useMemo, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Brain } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import ApplePressable from '../ApplePressable';
import { discoveryTheme } from './discoveryTheme';
import { OIL_BASE } from '../../lib/discovery/intelligenceBrand';
import { useAuthStore } from '../../store/useAuthStore';
import { useIntelligencePreferenceStore } from '../../store/useIntelligencePreferenceStore';
import { useIsDarkTheme } from '../../store/useThemeStore';
import { useI18n } from '../../i18n';

type Props = {
  navigation: { goBack?: () => void; canGoBack?: () => boolean; navigate?: (name: string) => void };
  children: ReactNode;
};

/**
 * Mounts Discovery surfaces only when EstateOS™ Intelligence is enabled.
 * When off, shows an enable gate instead of loading feed/tropes.
 */
export default function IntelligenceRequired({ navigation, children }: Props) {
  const { t } = useI18n();
  const isDark = useIsDarkTheme();
  const theme = useMemo(() => discoveryTheme(isDark), [isDark]);
  const token = useAuthStore((s) => s.token);
  const enabled = useIntelligencePreferenceStore((s) => s.enabled);
  const hydrated = useIntelligencePreferenceStore((s) => s.hydrated);
  const hydrate = useIntelligencePreferenceStore((s) => s.hydrate);
  const setEnabled = useIntelligencePreferenceStore((s) => s.setEnabled);

  useEffect(() => {
    void hydrate(token);
  }, [hydrate, token]);

  if (!hydrated) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  if (!enabled) {
    return (
      <View style={[styles.root, { backgroundColor: theme.bg }]}>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: theme.accentSoft, borderColor: theme.cardAccentBorder },
            ]}
          >
            <LinearGradient
              colors={[...OIL_BASE]}
              start={{ x: 0.05, y: 0.1 }}
              end={{ x: 0.95, y: 0.9 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View pointerEvents="none" style={styles.iconSheen} />
            <Brain size={30} color="#FFFFFF" strokeWidth={2} />
          </View>
          <Text style={[styles.kicker, { color: theme.eyebrow }]}>ESTATEOS™</Text>
          <Text style={[styles.title, { color: theme.text }]}>
            {t('profile.intelligence.gateTitle')}
          </Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>
            {t('profile.intelligence.gateBody')}
          </Text>
          <ApplePressable
            style={[styles.primary, { backgroundColor: theme.primaryBtn }]}
            haptic="medium"
            accessibilityLabel={t('profile.intelligence.gateEnable')}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              void setEnabled(token, true);
            }}
          >
            <Text style={[styles.primaryText, { color: theme.primaryBtnText }]}>
              {t('profile.intelligence.gateEnable')}
            </Text>
          </ApplePressable>
          <ApplePressable
            style={styles.secondary}
            haptic="none"
            accessibilityLabel={t('profile.intelligence.gateLater')}
            onPress={() => {
              if (navigation?.canGoBack?.()) navigation.goBack?.();
              else navigation?.navigate?.('MainTabs');
            }}
          >
            <Text style={[styles.secondaryText, { color: theme.textMuted }]}>
              {t('profile.intelligence.gateLater')}
            </Text>
          </ApplePressable>
        </View>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  root: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 24,
    overflow: 'hidden',
  },
  iconSheen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  kicker: { fontSize: 11, fontWeight: '900', letterSpacing: 3.2 },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginTop: 8,
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginTop: 14,
  },
  primary: {
    marginTop: 32,
    minWidth: 220,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  primaryText: { fontSize: 16, fontWeight: '900' },
  secondary: { marginTop: 14, padding: 10 },
  secondaryText: { fontSize: 14, fontWeight: '600' },
});

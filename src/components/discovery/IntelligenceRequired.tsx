import React, { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import ApplePressable from '../ApplePressable';
import { DISCOVERY_COLORS } from './discoveryMotion';
import { useAuthStore } from '../../store/useAuthStore';
import { useIntelligencePreferenceStore } from '../../store/useIntelligencePreferenceStore';
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
      <View style={styles.loading}>
        <LinearGradient colors={['#0F1014', '#040405', '#11100D']} style={StyleSheet.absoluteFill} />
        <ActivityIndicator color={DISCOVERY_COLORS.gold} />
      </View>
    );
  }

  if (!enabled) {
    return (
      <View style={styles.root}>
        <LinearGradient colors={['#0F1014', '#040405', '#11100D']} style={StyleSheet.absoluteFill} />
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="sparkles" size={28} color={DISCOVERY_COLORS.gold} />
          </View>
          <Text style={styles.kicker}>ESTATEOS™</Text>
          <Text style={styles.title}>{t('profile.intelligence.gateTitle')}</Text>
          <Text style={styles.body}>{t('profile.intelligence.gateBody')}</Text>
          <ApplePressable
            style={styles.primary}
            haptic="medium"
            accessibilityLabel={t('profile.intelligence.gateEnable')}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              void setEnabled(token, true);
            }}
          >
            <Text style={styles.primaryText}>{t('profile.intelligence.gateEnable')}</Text>
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
            <Text style={styles.secondaryText}>{t('profile.intelligence.gateLater')}</Text>
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
  card: { width: '100%', maxWidth: 420, alignItems: 'center' },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.4)',
    marginBottom: 24,
  },
  kicker: { color: DISCOVERY_COLORS.gold, fontSize: 11, fontWeight: '900', letterSpacing: 3.2 },
  title: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginTop: 8,
    textAlign: 'center',
  },
  body: {
    color: DISCOVERY_COLORS.ivory,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginTop: 14,
    opacity: 0.9,
  },
  primary: {
    marginTop: 32,
    minWidth: 220,
    height: 52,
    borderRadius: 26,
    backgroundColor: DISCOVERY_COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  primaryText: { color: '#060606', fontSize: 16, fontWeight: '900' },
  secondary: { marginTop: 14, padding: 10 },
  secondaryText: { color: DISCOVERY_COLORS.textMuted, fontSize: 14, fontWeight: '600' },
});

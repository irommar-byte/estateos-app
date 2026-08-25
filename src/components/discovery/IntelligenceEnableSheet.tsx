import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Brain, Compass, Shield, Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import ApplePressable from '../ApplePressable';
import { playIntelligenceChime } from '../../lib/discovery/intelligenceChime';
import { useAuthStore } from '../../store/useAuthStore';
import { useIntelligencePreferenceStore } from '../../store/useIntelligencePreferenceStore';
import { useIsDarkTheme } from '../../store/useThemeStore';
import { DISCOVERY_COLORS } from './discoveryMotion';
import { useI18n } from '../../i18n';
import { useLaunchPromptSlot } from '../../hooks/useLaunchPromptSlot';
import { isIntelligenceEnablePromptSnoozed } from '../../services/intelligencePreferenceService';

/**
 * First-login proposal to turn on EstateOS™ Intelligence — PL / EN / RU.
 * Waits for remote preference sync and a launch-prompt slot so splash/passkey/rating
 * cannot bury it forever.
 */
export default function IntelligenceEnableSheet() {
  const { t } = useI18n();
  const isDark = useIsDarkTheme();
  const token = useAuthStore((s) => s.token);
  const enabled = useIntelligencePreferenceStore((s) => s.enabled);
  const decided = useIntelligencePreferenceStore((s) => s.decided);
  const hydrated = useIntelligencePreferenceStore((s) => s.hydrated);
  const synced = useIntelligencePreferenceStore((s) => s.synced);
  const setEnabled = useIntelligencePreferenceStore((s) => s.setEnabled);
  const snoozeEnablePrompt = useIntelligencePreferenceStore((s) => s.snoozeEnablePrompt);
  const [sessionDismissed, setSessionDismissed] = useState(false);
  const [snoozed, setSnoozed] = useState(true);

  useEffect(() => {
    let alive = true;
    void isIntelligenceEnablePromptSnoozed().then((next) => {
      if (alive) setSnoozed(next);
    });
    return () => {
      alive = false;
    };
  }, []);

  const eligible =
    hydrated &&
    synced &&
    Boolean(token) &&
    !decided &&
    !enabled &&
    !sessionDismissed &&
    !snoozed;
  const canShow = useLaunchPromptSlot('intelligence', eligible);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!canShow) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => {
      setVisible(true);
      void playIntelligenceChime('suggest');
    }, 480);
    return () => clearTimeout(timer);
  }, [canShow]);

  const handleEnable = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void setEnabled(token, true);
    setVisible(false);
  };

  const handleLater = () => {
    void Haptics.selectionAsync();
    void snoozeEnablePrompt();
    setSnoozed(true);
    setVisible(false);
  };

  const handleBackdrop = () => {
    void Haptics.selectionAsync();
    setSessionDismissed(true);
    setVisible(false);
  };

  const features = [
    { icon: Compass, text: t('discovery.enable.featurePulse') },
    { icon: Sparkles, text: t('discovery.enable.featureSuggestions') },
    { icon: Shield, text: t('discovery.enable.featureWhispers') },
  ];

  const sheetBg = isDark ? 'rgba(12,14,18,0.92)' : 'rgba(255,255,255,0.97)';
  const border = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(17,24,39,0.1)';
  const titleColor = isDark ? '#FFFFFF' : '#111827';
  const muted = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(17,24,39,0.58)';
  const eyebrow = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(17,24,39,0.45)';
  const featureBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(17,24,39,0.04)';
  const featureBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,24,39,0.08)';
  const featureText = isDark ? 'rgba(255,255,255,0.75)' : 'rgba(17,24,39,0.72)';
  const featureIconBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(14,165,233,0.1)';
  const laterBorder = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(17,24,39,0.12)';
  const laterBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(17,24,39,0.04)';
  const laterText = isDark ? '#F5F5F7' : '#111827';
  const brainAuraBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(14,165,233,0.08)';
  const brainAuraBorder = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(14,165,233,0.2)';
  const brainCoreBg = isDark ? 'rgba(56,189,248,0.22)' : 'rgba(14,165,233,0.16)';
  const brainIcon = isDark ? '#E0F2FE' : '#0369A1';
  const featureIconColor = isDark ? '#BAE6FD' : '#0284C7';

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={handleBackdrop}>
      <View style={styles.root}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(15,23,42,0.35)' }]}
          onPress={handleBackdrop}
          accessibilityLabel={t('discovery.enable.laterA11y')}
        />
        <BlurView
          intensity={isDark ? 96 : 88}
          tint={isDark ? 'dark' : 'light'}
          style={[styles.sheet, { backgroundColor: sheetBg, borderColor: border }]}
        >
          <View style={[styles.glowA, !isDark && styles.glowALight]} />
          <View style={[styles.glowB, !isDark && styles.glowBLight]} />
          <View style={styles.brainWrap}>
            <View style={[styles.brainAura, { backgroundColor: brainAuraBg, borderColor: brainAuraBorder }]} />
            <View style={[styles.brainCore, { backgroundColor: brainCoreBg }]}>
              <Brain size={34} color={brainIcon} strokeWidth={1.6} />
            </View>
          </View>
          <Text style={[styles.eyebrow, { color: eyebrow }]}>{t('discovery.brand')}</Text>
          <Text style={[styles.title, { color: titleColor }]}>{t('discovery.enable.title')}</Text>
          <Text style={[styles.body, { color: muted }]}>{t('discovery.enable.body')}</Text>
          <View style={styles.features}>
            {features.map(({ icon: Icon, text }) => (
              <View key={text} style={[styles.featureRow, { backgroundColor: featureBg, borderColor: featureBorder }]}>
                <View style={[styles.featureIcon, { backgroundColor: featureIconBg }]}>
                  <Icon size={14} color={featureIconColor} />
                </View>
                <Text style={[styles.featureText, { color: featureText }]}>{text}</Text>
              </View>
            ))}
          </View>
          <ApplePressable style={styles.enable} onPress={handleEnable} haptic="medium">
            <Text style={styles.enableText}>{t('discovery.enable.cta')}</Text>
          </ApplePressable>
          <ApplePressable
            style={[styles.later, { borderColor: laterBorder, backgroundColor: laterBg }]}
            onPress={handleLater}
            haptic="none"
          >
            <Text style={[styles.laterText, { color: laterText }]}>{t('discovery.enable.later')}</Text>
          </ApplePressable>
        </BlurView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 12,
    paddingBottom: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
  },
  glowA: {
    position: 'absolute',
    left: -64,
    top: -64,
    width: 176,
    height: 176,
    borderRadius: 88,
    backgroundColor: 'rgba(56,189,248,0.22)',
  },
  glowALight: {
    backgroundColor: 'rgba(14,165,233,0.12)',
  },
  glowB: {
    position: 'absolute',
    right: -40,
    bottom: -80,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(52,211,153,0.18)',
  },
  glowBLight: {
    backgroundColor: 'rgba(16,185,129,0.1)',
  },
  brainWrap: {
    alignSelf: 'center',
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brainAura: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
  },
  brainCore: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    marginTop: 18,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  body: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19,
  },
  features: { marginTop: 18, gap: 10 },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  featureIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  enable: {
    marginTop: 22,
    height: 50,
    borderRadius: 25,
    backgroundColor: DISCOVERY_COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enableText: { color: '#080808', fontSize: 14, fontWeight: '900' },
  later: {
    marginTop: 10,
    height: 46,
    borderRadius: 23,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  laterText: { fontSize: 13, fontWeight: '800' },
});

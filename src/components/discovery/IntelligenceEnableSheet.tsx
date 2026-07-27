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
import { DISCOVERY_COLORS } from './discoveryMotion';

/**
 * iOS-style first-login proposal to turn on EstateOS™ Inteligence.
 */
export default function IntelligenceEnableSheet() {
  const token = useAuthStore((s) => s.token);
  const enabled = useIntelligencePreferenceStore((s) => s.enabled);
  const decided = useIntelligencePreferenceStore((s) => s.decided);
  const hydrated = useIntelligencePreferenceStore((s) => s.hydrated);
  const setEnabled = useIntelligencePreferenceStore((s) => s.setEnabled);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!hydrated || !token || decided || enabled) {
      setVisible(false);
      return;
    }
    const t = setTimeout(() => {
      setVisible(true);
      void playIntelligenceChime('suggest');
    }, 1600);
    return () => clearTimeout(t);
  }, [hydrated, token, decided, enabled]);

  const handleEnable = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void setEnabled(token, true);
    setVisible(false);
  };

  const handleLater = () => {
    void Haptics.selectionAsync();
    void setEnabled(token, false);
    setVisible(false);
  };

  const features = [
    { icon: Compass, text: 'Pulse z żywym mózgiem — kiedy kierunek się wyostrza' },
    { icon: Sparkles, text: 'Sugestie „bliżej Twojego kierunku” w katalogu i na mapie' },
    { icon: Shield, text: 'Szepty przed kontaktem i wizytą — tylko gdy mają sens' },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={handleLater}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={handleLater} accessibilityLabel="Nie teraz" />
        <BlurView intensity={96} tint="dark" style={styles.sheet}>
          <View style={styles.glowA} />
          <View style={styles.glowB} />
          <View style={styles.brainWrap}>
            <View style={styles.brainAura} />
            <View style={styles.brainCore}>
              <Brain size={34} color="#E0F2FE" strokeWidth={1.6} />
            </View>
          </View>
          <Text style={styles.eyebrow}>EstateOS™ Inteligence</Text>
          <Text style={styles.title}>Włącz Inteligence</Text>
          <Text style={styles.body}>
            Spokojny system, który uczy się z Twoich decyzji i podpowiada tropy — bez hałasu, jak prywatny
            asystent na iOS.
          </Text>
          <View style={styles.features}>
            {features.map(({ icon: Icon, text }) => (
              <View key={text} style={styles.featureRow}>
                <View style={styles.featureIcon}>
                  <Icon size={14} color="#BAE6FD" />
                </View>
                <Text style={styles.featureText}>{text}</Text>
              </View>
            ))}
          </View>
          <ApplePressable style={styles.enable} onPress={handleEnable} haptic="medium">
            <Text style={styles.enableText}>Włącz EstateOS™ Inteligence</Text>
          </ApplePressable>
          <ApplePressable style={styles.later} onPress={handleLater} haptic="none">
            <Text style={styles.laterText}>Nie teraz</Text>
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
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(12,14,18,0.9)',
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
  glowB: {
    position: 'absolute',
    right: -40,
    bottom: -80,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(52,211,153,0.18)',
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
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  brainCore: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(56,189,248,0.22)',
  },
  eyebrow: {
    marginTop: 18,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 8,
    textAlign: 'center',
    color: '#FFF',
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  body: {
    marginTop: 10,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.6)',
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
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  featureIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  featureText: {
    flex: 1,
    color: 'rgba(255,255,255,0.75)',
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
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  laterText: { color: '#F5F5F7', fontSize: 13, fontWeight: '800' },
});

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import ApplePressable from '../components/ApplePressable';
import { DISCOVERY_COLORS, DISCOVERY_EASE_OUT, DISCOVERY_MOTION } from '../components/discovery/discoveryMotion';
import { useDiscoveryStore } from '../store/useDiscoveryStore';
import { useAuthStore } from '../store/useAuthStore';

export default function DiscoveryEntryScreen({ navigation }: any) {
  const [expanded, setExpanded] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.88)).current;
  const setFirstEntrySeen = useDiscoveryStore((state: any) => state.setFirstEntrySeen);
  const persistDiscoveryExperience = useDiscoveryStore((state) => state.persist);
  const userId = useAuthStore((state) => state.user?.id);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: DISCOVERY_MOTION.breathe, easing: DISCOVERY_EASE_OUT, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }),
    ]).start();
  }, [opacity, scale]);

  const enter = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFirstEntrySeen(true);
    await persistDiscoveryExperience(userId);
    navigation.replace('EstateDiscovery');
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#0F1014', '#040405', '#11100D']} style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.content, { opacity, transform: [{ scale }] }]}>
        <View style={styles.portal}>
          <BlurView intensity={80} tint="dark" style={styles.portalBlur}>
            <View style={styles.portalCore}>
              <Ionicons name="sparkles" size={34} color={DISCOVERY_COLORS.gold} />
            </View>
          </BlurView>
        </View>
        <Text style={styles.kicker}>ESTATEOS™</Text>
        <Text style={styles.title}>Discovery™</Text>
        <Text style={styles.lead}>Nie musisz jeszcze wiedzieć.{'\n'}Najpierw poczuj miejsca.</Text>

        {expanded ? (
          <Text style={styles.more}>
            Discovery uczy się z Twoich wyborów, nie z ankiety. Możesz zmieniać kierunek i zatrzymać się w każdej chwili.
          </Text>
        ) : null}

        <ApplePressable style={styles.enterButton} onPress={enter} haptic="medium" accessibilityLabel="Wejdź do Discovery">
          <Ionicons name="arrow-forward" size={18} color="#060606" />
          <Text style={styles.enterText}>Wejdź</Text>
        </ApplePressable>
        <ApplePressable style={styles.moreButton} onPress={() => setExpanded((value) => !value)} haptic="none" accessibilityLabel="Czym jest Discovery">
          <Text style={styles.moreText}>{expanded ? 'Mniej' : 'Czym jest Discovery?'}</Text>
        </ApplePressable>
        <ApplePressable style={styles.laterButton} onPress={() => navigation.goBack()} haptic="none" accessibilityLabel="Nie teraz">
          <Text style={styles.laterText}>Nie teraz</Text>
        </ApplePressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  content: { width: '100%', maxWidth: 420, alignItems: 'center', paddingBottom: Platform.OS === 'ios' ? 34 : 20 },
  portal: {
    width: 132,
    height: 132,
    borderRadius: 66,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.48)',
    marginBottom: 32,
  },
  portalBlur: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(212,175,55,0.1)' },
  portalCore: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  kicker: { color: DISCOVERY_COLORS.gold, fontSize: 11, fontWeight: '900', letterSpacing: 3.2 },
  title: { color: '#FFF', fontSize: 39, fontWeight: '800', letterSpacing: -1.2, marginTop: 5 },
  lead: { color: DISCOVERY_COLORS.ivory, fontSize: 19, fontWeight: '600', lineHeight: 27, textAlign: 'center', marginTop: 20 },
  more: { color: DISCOVERY_COLORS.textMuted, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 18, paddingHorizontal: 10 },
  enterButton: {
    marginTop: 38,
    minWidth: 172,
    height: 54,
    paddingHorizontal: 22,
    borderRadius: 27,
    backgroundColor: DISCOVERY_COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  enterText: { color: '#060606', fontSize: 16, fontWeight: '900' },
  moreButton: { marginTop: 18, padding: 8 },
  moreText: { color: DISCOVERY_COLORS.ivory, fontSize: 14, fontWeight: '700' },
  laterButton: { marginTop: 8, padding: 8 },
  laterText: { color: DISCOVERY_COLORS.textMuted, fontSize: 13, fontWeight: '600' },
});

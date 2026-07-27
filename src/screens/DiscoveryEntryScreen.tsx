import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ApplePressable from '../components/ApplePressable';
import IntelligenceRequired from '../components/discovery/IntelligenceRequired';
import DiscoveryScreenChrome from '../components/discovery/DiscoveryScreenChrome';
import { discoveryTheme } from '../components/discovery/discoveryTheme';
import { DISCOVERY_EASE_OUT, DISCOVERY_MOTION } from '../components/discovery/discoveryMotion';
import { useDiscoveryStore } from '../store/useDiscoveryStore';
import { useAuthStore } from '../store/useAuthStore';
import { useIsDarkTheme } from '../store/useThemeStore';

export default function DiscoveryEntryScreen({ navigation }: any) {
  return (
    <IntelligenceRequired navigation={navigation}>
      <DiscoveryEntryInner navigation={navigation} />
    </IntelligenceRequired>
  );
}

function DiscoveryEntryInner({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const isDark = useIsDarkTheme();
  const theme = useMemo(() => discoveryTheme(isDark), [isDark]);
  const [expanded, setExpanded] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.88)).current;
  const setFirstEntrySeen = useDiscoveryStore((state: any) => state.setFirstEntrySeen);
  const persistDiscoveryExperience = useDiscoveryStore((state) => state.persist);
  const userId = useAuthStore((state) => state.user?.id);

  const brand = isDark ? '#D4AF37' : '#B45309';
  const brandSoft = isDark ? 'rgba(212,175,55,0.12)' : 'rgba(245,158,11,0.14)';
  const brandBorder = isDark ? 'rgba(212,175,55,0.48)' : 'rgba(180,83,9,0.35)';
  const portalCoreBg = isDark ? 'rgba(0,0,0,0.42)' : 'rgba(255,255,255,0.92)';

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: DISCOVERY_MOTION.breathe,
        easing: DISCOVERY_EASE_OUT,
        useNativeDriver: true,
      }),
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }),
    ]).start();
  }, [opacity, scale]);

  const goBack = () => {
    if (navigation?.canGoBack?.()) navigation.goBack();
    else navigation?.navigate?.('MainTabs', { screen: 'Market' });
  };

  const enter = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFirstEntrySeen(true);
    await persistDiscoveryExperience(userId);
    navigation.replace('EstateDiscovery');
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.bg, paddingTop: insets.top + 8 }]}>
      <View style={{ width: '100%', maxWidth: 420, paddingHorizontal: 18 }}>
        <DiscoveryScreenChrome theme={theme} onBack={goBack} />
      </View>
      <Animated.View style={[styles.content, { opacity, transform: [{ scale }] }]}>
        <View style={[styles.portal, { borderColor: brandBorder }]}>
          <BlurView intensity={isDark ? 80 : 40} tint={isDark ? 'dark' : 'light'} style={styles.portalBlur}>
            <View style={[styles.portalCore, { backgroundColor: portalCoreBg, borderColor: theme.cardBorder }]}>
              <View style={[styles.portalGlow, { backgroundColor: brandSoft }]} />
              <Ionicons name="sparkles" size={34} color={brand} />
            </View>
          </BlurView>
        </View>
        <Text style={[styles.kicker, { color: brand }]}>ESTATEOS™</Text>
        <Text style={[styles.title, { color: theme.text }]}>Discovery™</Text>
        <Text style={[styles.lead, { color: theme.textSecondary }]}>
          Nie musisz jeszcze wiedzieć.{'\n'}Najpierw poczuj miejsca.
        </Text>

        {expanded ? (
          <Text style={[styles.more, { color: theme.textMuted }]}>
            Discovery uczy się z Twoich wyborów, nie z ankiety. Możesz zmieniać kierunek i zatrzymać się w
            każdej chwili.
          </Text>
        ) : null}

        <ApplePressable
          style={[styles.enterButton, { backgroundColor: brand }]}
          onPress={enter}
          haptic="medium"
          accessibilityLabel="Wejdź do Discovery"
        >
          <Ionicons name="arrow-forward" size={18} color={isDark ? '#060606' : '#FFFFFF'} />
          <Text style={[styles.enterText, { color: isDark ? '#060606' : '#FFFFFF' }]}>Wejdź</Text>
        </ApplePressable>
        <ApplePressable
          style={styles.moreButton}
          onPress={() => setExpanded((value) => !value)}
          haptic="none"
          accessibilityLabel="Czym jest Discovery"
        >
          <Text style={[styles.moreText, { color: theme.textSecondary }]}>
            {expanded ? 'Mniej' : 'Czym jest Discovery?'}
          </Text>
        </ApplePressable>
        <ApplePressable style={styles.laterButton} onPress={goBack} haptic="none" accessibilityLabel="Nie teraz">
          <Text style={[styles.laterText, { color: theme.textMuted }]}>Nie teraz</Text>
        </ApplePressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 24 },
  content: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  portal: {
    width: 132,
    height: 132,
    borderRadius: 66,
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: 32,
  },
  portalBlur: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  portalCore: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  portalGlow: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.9,
  },
  kicker: { fontSize: 11, fontWeight: '900', letterSpacing: 3.2 },
  title: { fontSize: 39, fontWeight: '800', letterSpacing: -1.2, marginTop: 5 },
  lead: { fontSize: 19, fontWeight: '600', lineHeight: 27, textAlign: 'center', marginTop: 20 },
  more: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 18, paddingHorizontal: 10 },
  enterButton: {
    marginTop: 38,
    minWidth: 172,
    height: 54,
    paddingHorizontal: 22,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  enterText: { fontSize: 16, fontWeight: '900' },
  moreButton: { marginTop: 18, padding: 8 },
  moreText: { fontSize: 14, fontWeight: '700' },
  laterButton: { marginTop: 8, padding: 8 },
  laterText: { fontSize: 13, fontWeight: '600' },
});

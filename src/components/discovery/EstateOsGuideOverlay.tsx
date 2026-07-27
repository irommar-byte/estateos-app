import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ApplePressable from '../ApplePressable';
import { DISCOVERY_COLORS } from './discoveryMotion';
import { useDiscoveryStore } from '../../store/useDiscoveryStore';
import { fetchEstateOsGuideContext, type EstateOsGuideContext } from '../../services/discoveryService';
import { useAuthStore } from '../../store/useAuthStore';

type Props = { navigation: any };

type Sparkle = { id: number; left: number; top: number; size: number; delay: number };

/**
 * Guide tylko na Mapy+Radar, po LEWEJ pod chrome —
 * z mikro-błyskami gwiazdek i hover/stylus zoom.
 */
export default function EstateOsGuideOverlay({ navigation }: Props) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const profile = useDiscoveryStore((state) => state.profile);
  const firstEntrySeen = useDiscoveryStore((state) => state.firstEntrySeen);
  const token = useAuthStore((state) => state.token);
  const [guide, setGuide] = useState<EstateOsGuideContext | null>(null);
  const compact = width < 420;
  const iconOnly = width < 360;

  const hoverScale = useRef(new Animated.Value(1)).current;
  const hoverGlow = useRef(new Animated.Value(0)).current;
  const sparkleOpacity = useRef(new Animated.Value(0)).current;
  const sparkleSpin = useRef(new Animated.Value(0)).current;
  const sparkles = useMemo<Sparkle[]>(
    () => [
      { id: 1, left: 6, top: -4, size: 10, delay: 0 },
      { id: 2, left: 38, top: -8, size: 8, delay: 180 },
      { id: 3, left: 72, top: 2, size: 11, delay: 320 },
      { id: 4, left: 18, top: 34, size: 7, delay: 480 },
      { id: 5, left: 58, top: 36, size: 9, delay: 640 },
    ],
    [],
  );

  useEffect(() => {
    void fetchEstateOsGuideContext(token).then(setGuide);
  }, [token]);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(hoverScale, {
        toValue: hovered ? 1.08 : 1,
        friction: 6,
        tension: 160,
        useNativeDriver: true,
      }),
      Animated.timing(hoverGlow, {
        toValue: hovered ? 1 : 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [hovered, hoverGlow, hoverScale]);

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const burst = () => {
      if (cancelled || open) return;
      sparkleOpacity.setValue(0);
      sparkleSpin.setValue(0);
      Animated.sequence([
        Animated.parallel([
          Animated.timing(sparkleOpacity, {
            toValue: 1,
            duration: 280,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(sparkleSpin, {
            toValue: 1,
            duration: 900,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(sparkleOpacity, {
          toValue: 0,
          duration: 420,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
      timeout = setTimeout(burst, 5200 + Math.floor(Math.random() * 2400));
    };

    timeout = setTimeout(burst, 1600);
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [open, sparkleOpacity, sparkleSpin]);

  const lead =
    guide?.nextStep?.title ||
    (profile?.confidence && profile.confidence > 0.35
      ? 'Widzę Twój kierunek. Zobaczmy, co teraz najbardziej go wzmacnia.'
      : 'Zacznijmy od tego, co jest dla Ciebie ważne.');

  // Niżej, żeby nie nachodził na Live Radar / Moje·Ulubione / zarządzanie.
  const topOffset = Math.max(insets.top, Platform.OS === 'ios' ? 48 : 28) + (compact ? 118 : 128);

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.root,
        {
          top: topOffset,
          maxHeight: Math.max(240, height - topOffset - 140),
          maxWidth: Math.min(300, width - 24),
        },
      ]}
    >
      {open ? (
        <BlurView intensity={72} tint="dark" style={[styles.panel, compact && styles.panelCompact]}>
          <View style={styles.panelHead}>
            <View style={styles.guideMark}>
              <Ionicons name="sparkles" size={16} color={DISCOVERY_COLORS.gold} />
            </View>
            <View style={styles.headCopy}>
              <Text style={styles.name}>EstateOS Guide</Text>
              <Text style={styles.sub}>Jestem tutaj, aby wspierać Cię.</Text>
            </View>
            <ApplePressable onPress={() => setOpen(false)} haptic="none" style={styles.close}>
              <Ionicons name="close" size={18} color="#FFF" />
            </ApplePressable>
          </View>
          <Text style={[styles.lead, compact && styles.leadCompact]}>{lead}</Text>
          <ApplePressable
            onPress={() => {
              setOpen(false);
              navigation.navigate(firstEntrySeen ? 'EstateDiscovery' : 'DiscoveryEntry');
            }}
            style={styles.action}
          >
            <Ionicons name="compass-outline" size={17} color={DISCOVERY_COLORS.gold} />
            <Text style={styles.actionText}>Znajdź przestrzeń, która do mnie pasuje</Text>
            <Ionicons name="arrow-forward" size={15} color={DISCOVERY_COLORS.gold} />
          </ApplePressable>
          <ApplePressable
            onPress={() => {
              setOpen(false);
              navigation.navigate('DiscoveryTropes');
            }}
            style={styles.action}
          >
            <Ionicons name="bookmark-outline" size={17} color={DISCOVERY_COLORS.gold} />
            <Text style={styles.actionText}>Pokaż moje ważne tropy</Text>
            <Ionicons name="arrow-forward" size={15} color={DISCOVERY_COLORS.gold} />
          </ApplePressable>
          <ApplePressable
            onPress={() => {
              setOpen(false);
              navigation.navigate('DiscoveryDirection');
            }}
            style={styles.action}
          >
            <Ionicons name="navigate-outline" size={17} color={DISCOVERY_COLORS.gold} />
            <Text style={styles.actionText}>Podpowiedz mi kolejny krok</Text>
            <Ionicons name="arrow-forward" size={15} color={DISCOVERY_COLORS.gold} />
          </ApplePressable>
          <ApplePressable
            onPress={() => {
              setOpen(false);
              navigation.navigate('DiscoveryLustro');
            }}
            style={styles.action}
          >
            <Ionicons name="sparkles-outline" size={17} color={DISCOVERY_COLORS.gold} />
            <Text style={styles.actionText}>Lustro preferencji</Text>
            <Ionicons name="arrow-forward" size={15} color={DISCOVERY_COLORS.gold} />
          </ApplePressable>
        </BlurView>
      ) : (
        <Animated.View
          style={{
            transform: [{ scale: hoverScale }],
          }}
        >
          <ApplePressable
            onPress={() => setOpen(true)}
            style={styles.pill}
            accessibilityLabel="Otwórz EstateOS Guide"
            // Hover / Apple Pencil proximity (RN pointer events on supported platforms)
            onHoverIn={() => setHovered(true)}
            onHoverOut={() => setHovered(false)}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                styles.hoverAura,
                {
                  opacity: hoverGlow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.9] }),
                  transform: [
                    {
                      scale: hoverGlow.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.18] }),
                    },
                  ],
                },
              ]}
            />
            <BlurView intensity={64} tint="dark" style={[styles.pillBlur, iconOnly && styles.pillIconOnly, hovered && styles.pillHovered]}>
              <View style={styles.guideMark}>
                <Ionicons name="sparkles" size={14} color={DISCOVERY_COLORS.gold} />
              </View>
              {!iconOnly ? (
                <View style={styles.pillCopy}>
                  <Text style={styles.name}>Guide</Text>
                  <Text style={styles.pillSub} numberOfLines={1}>
                    {profile?.confidence ? 'Twój kierunek' : 'Poznaj kierunek'}
                  </Text>
                </View>
              ) : null}
              {!iconOnly ? <Ionicons name="chevron-forward" size={14} color={DISCOVERY_COLORS.ivory} /> : null}
            </BlurView>
            <View pointerEvents="none" style={styles.sparkleLayer}>
              {sparkles.map((sparkle) => {
                const twinkle = sparkleOpacity.interpolate({
                  inputRange: [0, 0.35, 0.7, 1],
                  outputRange: [0, 1, 0.55, 0],
                });
                const drift = sparkleSpin.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -10 - sparkle.delay * 0.01],
                });
                const spin = sparkleSpin.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', `${12 + sparkle.id * 8}deg`],
                });
                return (
                  <Animated.View
                    key={sparkle.id}
                    style={[
                      styles.sparkle,
                      {
                        left: sparkle.left,
                        top: sparkle.top,
                        opacity: twinkle,
                        transform: [{ translateY: drift }, { rotate: spin }, { scale: hovered ? 1.15 : 1 }],
                      },
                    ]}
                  >
                    <Ionicons name="sparkles" size={sparkle.size} color={DISCOVERY_COLORS.gold} />
                  </Animated.View>
                );
              })}
            </View>
          </ApplePressable>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 12,
    zIndex: 35,
    alignItems: 'flex-start',
  },
  pill: {
    borderRadius: 22,
    overflow: 'visible',
  },
  hoverAura: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    backgroundColor: 'rgba(212,175,55,0.22)',
    shadowColor: '#D4AF37',
    shadowOpacity: 0.55,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  pillBlur: {
    minHeight: 44,
    maxWidth: 168,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
    backgroundColor: 'rgba(11,12,14,0.78)',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
  },
  pillHovered: {
    borderColor: 'rgba(212,175,55,0.72)',
    backgroundColor: 'rgba(24,20,12,0.88)',
  },
  pillIconOnly: {
    maxWidth: 44,
    minWidth: 44,
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  pillCopy: { flexShrink: 1 },
  sparkleLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'visible',
  },
  sparkle: {
    position: 'absolute',
  },
  panel: {
    width: 300,
    maxWidth: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    padding: 15,
    backgroundColor: 'rgba(11,12,14,0.88)',
  },
  panelCompact: {
    padding: 12,
  },
  panelHead: { flexDirection: 'row', alignItems: 'center' },
  guideMark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212,175,55,0.15)',
  },
  headCopy: { flex: 1, marginLeft: 9 },
  name: { color: DISCOVERY_COLORS.ivory, fontSize: 12, fontWeight: '900' },
  sub: { color: DISCOVERY_COLORS.textMuted, fontSize: 10, marginTop: 1 },
  pillSub: { color: DISCOVERY_COLORS.textMuted, fontSize: 10, marginTop: 1, maxWidth: 110 },
  close: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  lead: { color: '#FFF', fontSize: 17, lineHeight: 23, fontWeight: '700', marginTop: 14, marginBottom: 12 },
  leadCompact: { fontSize: 15, lineHeight: 21 },
  action: {
    minHeight: 48,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  actionText: { flex: 1, color: DISCOVERY_COLORS.ivory, fontSize: 12, fontWeight: '700' },
});

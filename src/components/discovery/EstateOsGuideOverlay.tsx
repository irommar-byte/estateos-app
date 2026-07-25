import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ApplePressable from '../ApplePressable';
import { DISCOVERY_COLORS } from './discoveryMotion';
import { useDiscoveryStore } from '../../store/useDiscoveryStore';
import { fetchEstateOsGuideContext, type EstateOsGuideContext } from '../../services/discoveryService';
import { useAuthStore } from '../../store/useAuthStore';

type Props = { navigation: any };

/**
 * Guide siedzi po LEWEJ, pod przyciskami warstw/ulubionych —
 * nigdy na środku nad Live Radar.
 */
export default function EstateOsGuideOverlay({ navigation }: Props) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const profile = useDiscoveryStore((state) => state.profile);
  const firstEntrySeen = useDiscoveryStore((state) => state.firstEntrySeen);
  const token = useAuthStore((state) => state.token);
  const [guide, setGuide] = useState<EstateOsGuideContext | null>(null);

  useEffect(() => {
    void fetchEstateOsGuideContext(token).then(setGuide);
  }, [token]);

  const lead =
    guide?.nextStep?.title ||
    (profile?.confidence && profile.confidence > 0.35
      ? 'Widzę Twój kierunek. Zobaczmy, co teraz najbardziej go wzmacnia.'
      : 'Zacznijmy od tego, co jest dla Ciebie ważne.');

  const topOffset = Math.max(insets.top, Platform.OS === 'ios' ? 48 : 28) + 56;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.root,
        {
          top: topOffset,
          maxHeight: Math.max(280, height - topOffset - 120),
        },
      ]}
    >
      {open ? (
        <BlurView intensity={72} tint="dark" style={styles.panel}>
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
          <Text style={styles.lead}>{lead}</Text>
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
              navigation.navigate('DiscoveryResume');
            }}
            style={styles.action}
          >
            <Ionicons name="navigate-outline" size={17} color={DISCOVERY_COLORS.gold} />
            <Text style={styles.actionText}>Podpowiedz mi kolejny krok</Text>
            <Ionicons name="arrow-forward" size={15} color={DISCOVERY_COLORS.gold} />
          </ApplePressable>
        </BlurView>
      ) : (
        <ApplePressable onPress={() => setOpen(true)} style={styles.pill} accessibilityLabel="Otwórz EstateOS Guide">
          <BlurView intensity={64} tint="dark" style={styles.pillBlur}>
            <View style={styles.guideMark}>
              <Ionicons name="sparkles" size={14} color={DISCOVERY_COLORS.gold} />
            </View>
            <View style={styles.pillCopy}>
              <Text style={styles.name}>Guide</Text>
              <Text style={styles.pillSub} numberOfLines={1}>
                {profile?.confidence ? 'Twój kierunek' : 'Poznaj kierunek'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={DISCOVERY_COLORS.ivory} />
          </BlurView>
        </ApplePressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 12,
    right: undefined,
    zIndex: 40,
    alignItems: 'flex-start',
    maxWidth: 300,
  },
  pill: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
    shadowColor: '#D4AF37',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
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
  },
  pillCopy: { flexShrink: 1 },
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

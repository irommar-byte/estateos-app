import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import ApplePressable from '../ApplePressable';
import { DISCOVERY_COLORS } from './discoveryMotion';
import { useDiscoveryStore } from '../../store/useDiscoveryStore';
import { fetchEstateOsGuideContext, type EstateOsGuideContext } from '../../services/discoveryService';
import { useAuthStore } from '../../store/useAuthStore';

type Props = { navigation: any };

export default function EstateOsGuideOverlay({ navigation }: Props) {
  const [open, setOpen] = useState(false);
  const profile = useDiscoveryStore((state) => state.profile);
  const firstEntrySeen = useDiscoveryStore((state) => state.firstEntrySeen);
  const token = useAuthStore((state) => state.token);
  const [guide, setGuide] = useState<EstateOsGuideContext | null>(null);
  useEffect(() => { void fetchEstateOsGuideContext(token).then(setGuide); }, [token]);
  const lead = guide?.nextStep?.title || (profile?.confidence && profile.confidence > 0.35
    ? 'Widzę Twój kierunek. Zobaczmy, co teraz najbardziej go wzmacnia.'
    : 'Zacznijmy od tego, co jest dla Ciebie ważne.');

  return (
    <View pointerEvents="box-none" style={styles.root}>
      {open ? (
        <BlurView intensity={72} tint="dark" style={styles.panel}>
          <View style={styles.panelHead}>
            <View style={styles.guideMark}><Ionicons name="sparkles" size={16} color={DISCOVERY_COLORS.gold} /></View>
            <View style={styles.headCopy}>
              <Text style={styles.name}>EstateOS Guide</Text>
              <Text style={styles.sub}>Jestem tutaj, aby wspierać Cię.</Text>
            </View>
            <ApplePressable onPress={() => setOpen(false)} haptic="none" style={styles.close}><Ionicons name="close" size={18} color="#FFF" /></ApplePressable>
          </View>
          <Text style={styles.lead}>{lead}</Text>
          <ApplePressable
            onPress={() => navigation.navigate(firstEntrySeen ? 'EstateDiscovery' : 'DiscoveryEntry')}
            style={styles.action}
          >
            <Ionicons name="compass-outline" size={17} color={DISCOVERY_COLORS.gold} />
            <Text style={styles.actionText}>Znajdź przestrzeń, która do mnie pasuje</Text>
            <Ionicons name="arrow-forward" size={15} color={DISCOVERY_COLORS.gold} />
          </ApplePressable>
          <ApplePressable onPress={() => navigation.navigate('DiscoveryTropes')} style={styles.action}>
            <Ionicons name="bookmark-outline" size={17} color={DISCOVERY_COLORS.gold} />
            <Text style={styles.actionText}>Pokaż moje ważne tropy</Text>
            <Ionicons name="arrow-forward" size={15} color={DISCOVERY_COLORS.gold} />
          </ApplePressable>
          <ApplePressable onPress={() => navigation.navigate('DiscoveryResume')} style={styles.action}>
            <Ionicons name="navigate-outline" size={17} color={DISCOVERY_COLORS.gold} />
            <Text style={styles.actionText}>Podpowiedz mi kolejny krok</Text>
            <Ionicons name="arrow-forward" size={15} color={DISCOVERY_COLORS.gold} />
          </ApplePressable>
        </BlurView>
      ) : null}
      <ApplePressable onPress={() => setOpen(true)} style={styles.pill} accessibilityLabel="Otwórz EstateOS Guide">
        <BlurView intensity={64} tint="dark" style={styles.pillBlur}>
          <View style={styles.guideMark}><Ionicons name="sparkles" size={15} color={DISCOVERY_COLORS.gold} /></View>
          <View>
            <Text style={styles.name}>EstateOS Guide</Text>
            <Text style={styles.pillSub} numberOfLines={1}>{profile?.confidence ? 'Twój kierunek jest gotowy' : 'Poznajmy Twój kierunek'}</Text>
          </View>
          <Ionicons name="equalizer-outline" size={17} color={DISCOVERY_COLORS.ivory} />
        </BlurView>
      </ApplePressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 58, left: 16, right: 16, zIndex: 80, alignItems: 'center' },
  pill: { borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  pillBlur: { minWidth: 244, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 10, backgroundColor: 'rgba(11,12,14,0.72)' },
  panel: { width: '100%', maxWidth: 390, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', padding: 15, backgroundColor: 'rgba(11,12,14,0.78)' },
  panelHead: { flexDirection: 'row', alignItems: 'center' },
  guideMark: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(212,175,55,0.15)' },
  headCopy: { flex: 1, marginLeft: 9 },
  name: { color: DISCOVERY_COLORS.ivory, fontSize: 12, fontWeight: '900' },
  sub: { color: DISCOVERY_COLORS.textMuted, fontSize: 10, marginTop: 1 },
  pillSub: { color: DISCOVERY_COLORS.textMuted, fontSize: 10, marginTop: 1, maxWidth: 150 },
  close: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  lead: { color: '#FFF', fontSize: 18, lineHeight: 24, fontWeight: '700', marginTop: 16, marginBottom: 14 },
  action: { minHeight: 48, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 12, flexDirection: 'row', gap: 9, alignItems: 'center', marginTop: 8, backgroundColor: 'rgba(255,255,255,0.06)' },
  actionText: { flex: 1, color: DISCOVERY_COLORS.ivory, fontSize: 12, fontWeight: '700' },
});

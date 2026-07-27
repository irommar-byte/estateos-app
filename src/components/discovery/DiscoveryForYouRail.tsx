import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { ArrowRight, Brain } from 'lucide-react-native';
import OfferDiscoveryActions from './OfferDiscoveryActions';
import { subscribeDiscoveryUpdated } from '../../lib/discovery/clientEvents';
import { fetchDiscoveryForYou, type ForYouRailItem } from '../../services/discoveryService';
import { useAuthStore } from '../../store/useAuthStore';
import { useIntelligencePreferenceStore } from '../../store/useIntelligencePreferenceStore';

type Props = {
  navigation: any;
  transactionMode?: 'all' | 'sale' | 'rent';
  formatPrice?: (item: ForYouRailItem) => string;
};

function defaultFormatPrice(item: ForYouRailItem): string {
  const amount = item.pricePln ?? item.price;
  if (!Number.isFinite(amount) || amount <= 0) return '—';
  return `${Math.round(amount).toLocaleString('pl-PL')} zł`;
}

/**
 * Living Inteligence rail for the signed-in client profile — brain-led, not sparkles.
 */
export default function DiscoveryForYouRail({
  navigation,
  transactionMode = 'all',
  formatPrice = defaultFormatPrice,
}: Props) {
  const token = useAuthStore((s) => s.token);
  const enabled = useIntelligencePreferenceStore((s) => s.enabled);
  const hydrated = useIntelligencePreferenceStore((s) => s.hydrated);
  const [items, setItems] = useState<ForYouRailItem[]>([]);
  const [ready, setReady] = useState(false);
  const [auth, setAuth] = useState<'unknown' | 'guest' | 'user'>('unknown');
  const [loading, setLoading] = useState(true);
  const livePulse = useRef(new Animated.Value(0)).current;

  const tx = useMemo(
    () => (transactionMode === 'sale' ? 'SALE' : transactionMode === 'rent' ? 'RENT' : '') as
      | 'SALE'
      | 'RENT'
      | '',
    [transactionMode],
  );

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(livePulse, {
          toValue: 1,
          duration: 2800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(livePulse, {
          toValue: 0,
          duration: 2800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [livePulse]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!token) {
        if (!cancelled) {
          setAuth('guest');
          setItems([]);
          setReady(false);
          setLoading(false);
        }
        return;
      }
      try {
        const data = await fetchDiscoveryForYou(token, { limit: 12, transaction: tx });
        if (cancelled) return;
        if (data.auth === 'guest') {
          setAuth('guest');
          setItems([]);
          setReady(false);
          return;
        }
        setAuth('user');
        setReady(Boolean(data.profile?.ready));
        setItems(Array.isArray(data.items) ? data.items : []);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    const unsub = subscribeDiscoveryUpdated(() => void load());
    return () => {
      cancelled = true;
      unsub();
    };
  }, [token, tx]);

  if (!hydrated || !enabled) return null;
  if (auth === 'guest' || auth === 'unknown') return null;
  if (loading) return null;

  const glowOpacity = livePulse.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.55] });
  const brainGlow = livePulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });

  const eyebrow = (
    <View style={styles.eyebrowRow}>
      <Animated.View style={[styles.brainBadge, { opacity: brainGlow }]}>
        <Brain size={13} color="#7DD3FC" strokeWidth={2.2} />
      </Animated.View>
      <Text style={styles.eyebrow}>EstateOS™ Inteligence</Text>
      <View style={styles.liveDotWrap}>
        <Animated.View style={[styles.liveDotPulse, { opacity: glowOpacity }]} />
        <View style={styles.liveDot} />
      </View>
      <Text style={styles.liveLabel}>dla Twojego profilu</Text>
    </View>
  );

  if (!ready) {
    return (
      <View style={styles.section}>
        <View style={styles.shell}>
          <Animated.View style={[styles.shellGlow, { opacity: glowOpacity }]} />
          <View style={styles.coldCopy}>
            {eyebrow}
            <Text style={styles.h2}>Bliżej Twojego kierunku</Text>
            <Text style={styles.coldBody}>
              Oceń kilka ofert spokojnie — tu pojawią się sugestie dopasowane do Ciebie.
            </Text>
          </View>
          <Pressable
            style={styles.directionChip}
            onPress={() => navigation?.navigate?.('DiscoveryDirection')}
          >
            <Text style={styles.directionChipText}>Mój kierunek</Text>
            <ArrowRight size={14} color="rgba(125,211,252,0.9)" />
          </Pressable>
        </View>
      </View>
    );
  }

  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.shell}>
        <Animated.View style={[styles.shellGlow, { opacity: glowOpacity }]} />
        <View style={styles.header}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {eyebrow}
            <Text style={styles.h2}>Bliżej Twojego kierunku</Text>
          </View>
          <Pressable
            style={styles.linkRow}
            onPress={() => navigation?.navigate?.('DiscoveryDirection')}
          >
            <Text style={styles.link}>Mój kierunek</Text>
            <ArrowRight size={13} color="rgba(125,211,252,0.7)" />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.rail}
        >
          {items.map((item) => (
            <Pressable
              key={item.offerId}
              style={styles.card}
              onPress={() =>
                navigation?.navigate?.('OfferDetail', { offerId: Number(item.offerId) })
              }
            >
              <View style={styles.imageWrap}>
                {item.imageUrl ? (
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={styles.image}
                    contentFit="cover"
                    transition={180}
                  />
                ) : (
                  <View style={[styles.image, styles.imageFallback]} />
                )}
                <View style={styles.actionsOverlay} pointerEvents="box-none">
                  <OfferDiscoveryActions
                    offerId={item.offerId}
                    variant="compact"
                    source="mobile_catalog_for_you"
                    onRequireAuth={() => navigation?.navigate?.('Login')}
                  />
                </View>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.meta} numberOfLines={1}>
                  {[item.city, item.district].filter(Boolean).join(' · ') || 'Polska'}
                  {item.area > 0 ? ` · ${Math.round(item.area)} m²` : ''}
                </Text>
                <Text style={styles.title} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.price}>{formatPrice(item)}</Text>
                {item.reason ? (
                  <Text style={styles.reason} numberOfLines={2}>
                    <Text style={styles.reasonLead}>Inteligence · </Text>
                    {item.reason}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 18, marginBottom: 8 },
  shell: {
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,189,248,0.28)',
    backgroundColor: 'rgba(6,12,22,0.72)',
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 14,
    overflow: 'hidden',
  },
  shellGlow: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(56,189,248,0.18)',
  },
  coldCopy: { gap: 6, paddingHorizontal: 4, marginBottom: 12 },
  coldBody: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    lineHeight: 19,
  },
  directionChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,189,248,0.28)',
    backgroundColor: 'rgba(56,189,248,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginHorizontal: 4,
  },
  directionChipText: {
    color: 'rgba(186,230,253,0.95)',
    fontSize: 11,
    fontWeight: '800',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  brainBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(56,189,248,0.16)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(125,211,252,0.45)',
  },
  eyebrow: {
    color: 'rgba(125,211,252,0.95)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  liveDotWrap: {
    width: 10,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDotPulse: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(56,189,248,0.45)',
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#38BDF8',
  },
  liveLabel: {
    color: 'rgba(186,230,253,0.55)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  h2: {
    marginTop: 6,
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  link: { color: 'rgba(186,230,253,0.7)', fontSize: 12, fontWeight: '700' },
  rail: { gap: 12, paddingRight: 4, paddingBottom: 2 },
  card: {
    width: 272,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,189,248,0.18)',
    backgroundColor: 'rgba(10,16,28,0.95)',
  },
  imageWrap: {
    position: 'relative',
    width: '100%',
    aspectRatio: 16 / 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  imageFallback: { backgroundColor: 'rgba(255,255,255,0.06)' },
  actionsOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 10,
    alignItems: 'center',
  },
  cardBody: { padding: 14, gap: 6 },
  meta: {
    color: 'rgba(186,230,253,0.55)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: { color: '#FFF', fontSize: 15, fontWeight: '700', lineHeight: 20 },
  price: { color: '#FFF', fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  reason: { color: 'rgba(245,245,247,0.55)', fontSize: 12, lineHeight: 17 },
  reasonLead: { color: 'rgba(125,211,252,0.95)', fontWeight: '700' },
});

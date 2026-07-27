import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ArrowRight, Sparkles } from 'lucide-react-native';
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
 * Apple Intelligence–quiet catalog rail: soft suggestions, one calm reason line.
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

  const tx = useMemo(
    () => (transactionMode === 'sale' ? 'SALE' : transactionMode === 'rent' ? 'RENT' : '') as
      | 'SALE'
      | 'RENT'
      | '',
    [transactionMode],
  );

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

  if (!ready) {
    return (
      <View style={styles.section}>
        <View style={styles.coldCard}>
          <View style={styles.coldCopy}>
            <View style={styles.eyebrowRow}>
              <Sparkles size={12} color="rgba(52,211,153,0.85)" />
              <Text style={styles.eyebrow}>EstateOS™ Inteligence</Text>
            </View>
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
            <ArrowRight size={14} color="rgba(255,255,255,0.8)" />
          </Pressable>
        </View>
      </View>
    );
  }

  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.eyebrowRow}>
            <Sparkles size={12} color="rgba(52,211,153,0.9)" />
            <Text style={styles.eyebrow}>EstateOS™ Inteligence</Text>
          </View>
          <Text style={styles.h2}>Bliżej Twojego kierunku</Text>
        </View>
        <Pressable
          style={styles.linkRow}
          onPress={() => navigation?.navigate?.('DiscoveryDirection')}
        >
          <Text style={styles.link}>Mój kierunek</Text>
          <ArrowRight size={13} color="rgba(245,245,247,0.55)" />
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
                <Image source={{ uri: item.imageUrl }} style={styles.image} />
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
                  <Text style={styles.reasonLead}>Sugestia · </Text>
                  {item.reason}
                </Text>
              ) : null}
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 18, marginBottom: 8 },
  coldCard: {
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(8,10,14,0.55)',
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 14,
  },
  coldCopy: { gap: 6 },
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
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  directionChipText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '800',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eyebrow: {
    color: 'rgba(52,211,153,0.9)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  h2: {
    marginTop: 4,
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  link: { color: 'rgba(245,245,247,0.55)', fontSize: 12, fontWeight: '700' },
  rail: { gap: 12, paddingRight: 8 },
  card: {
    width: 272,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(18,18,22,0.92)',
  },
  imageWrap: { aspectRatio: 16 / 10, backgroundColor: 'rgba(0,0,0,0.35)' },
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
    color: 'rgba(245,245,247,0.5)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: { color: '#FFF', fontSize: 15, fontWeight: '700', lineHeight: 20 },
  price: { color: '#FFF', fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  reason: { color: 'rgba(245,245,247,0.55)', fontSize: 12, lineHeight: 17 },
  reasonLead: { color: 'rgba(52,211,153,0.9)', fontWeight: '700' },
});

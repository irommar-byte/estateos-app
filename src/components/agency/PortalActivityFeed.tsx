import React, { useCallback, useEffect, useState } from 'react';
import { LayoutAnimation, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { API_URL } from '../../config/network';

type Item = {
  id: number;
  clientId: number;
  clientName: string;
  clientType: string | null;
  event: string;
  pending: boolean;
  title: string | null;
  body: string | null;
  createdAt: string;
  meta: Record<string, unknown>;
};

type Palette = { card: string; text: string; secondary: string; hairline: string; blue: string };

const ICON: Record<string, { icon: keyof typeof Ionicons.glyphMap; tint: string }> = {
  favorite: { icon: 'heart', tint: '#FF375F' },
  partner_rating: { icon: 'people', tint: '#AF52DE' },
  area_request: { icon: 'map', tint: '#FF9F0A' },
  area_saved: { icon: 'map', tint: '#34C759' },
  self_booking: { icon: 'calendar', tint: '#0A84FF' },
  buyer_offer_response: { icon: 'cash', tint: '#34C759' },
  document_uploaded: { icon: 'document-text', tint: '#FF9F0A' },
  review: { icon: 'star', tint: '#FFD60A' },
  referral: { icon: 'person-add', tint: '#34C759' },
  app_joined: { icon: 'phone-portrait', tint: '#0A84FF' },
};

function ago(iso: string): string {
  const min = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 60) return `${min} min temu`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} godz. temu`;
  const d = Math.round(h / 24);
  return d === 1 ? 'wczoraj' : `${d} dni temu`;
}

/** „Dziś → U klientów”: co klienci zrobili w swoich panelach i aplikacji. */
export default function PortalActivityFeed({
  token,
  palette,
  onOpenClient,
}: {
  token: string | null;
  palette: Palette;
  onOpenClient: (clientId: number) => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/crm/portal-activity`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(json?.items)) setItems(json.items as Item[]);
    } catch {
      /* best-effort */
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (!items.length) return null;
  const visible = expanded ? items : items.slice(0, 5);

  return (
    <View style={{ marginTop: 22 }}>
      <View style={styles.head}>
        <View style={[styles.headIcon, { backgroundColor: 'rgba(10,132,255,0.14)' }]}>
          <Ionicons name="sparkles" size={15} color={palette.blue} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: palette.text }]}>U klientów</Text>
          <Text style={{ color: palette.secondary, fontSize: 12 }}>Co klienci robią w swoich panelach</Text>
        </View>
      </View>
      <View style={[styles.card, { backgroundColor: palette.card }]}>
        {visible.map((item, index) => {
          const meta = ICON[item.event] || { icon: 'ellipse' as const, tint: palette.secondary };
          const referral = item.event === 'referral' ? (item.meta.referral as { name?: string; phone?: string | null } | undefined) : undefined;
          return (
            <Pressable
              key={item.id}
              onPress={() => onOpenClient(item.clientId)}
              style={[styles.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.hairline }]}
            >
              <View style={[styles.icon, { backgroundColor: `${meta.tint}22` }]}>
                <Ionicons name={meta.icon} size={16} color={meta.tint} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.text, fontSize: 15, fontWeight: '600' }} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={{ color: palette.secondary, fontSize: 13, marginTop: 2 }} numberOfLines={2}>
                  {item.clientName}
                  {item.body ? ` · ${item.body}` : ''}
                </Text>
                <Text style={{ color: palette.secondary, fontSize: 11, marginTop: 3 }}>
                  {ago(item.createdAt)}
                  {item.pending ? ' · czeka na Ciebie' : ''}
                </Text>
                {referral?.phone ? (
                  <Pressable onPress={() => void Linking.openURL(`tel:${String(referral.phone).replace(/[^\d+]/g, '')}`)} style={styles.callBtn} hitSlop={6}>
                    <Ionicons name="call" size={13} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Zadzwoń do {referral.name || 'polecanej osoby'}</Text>
                  </Pressable>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={16} color={palette.secondary} />
            </Pressable>
          );
        })}
      </View>
      {items.length > 5 ? (
        <Pressable
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setExpanded((v) => !v);
          }}
          style={{ alignSelf: 'center', paddingVertical: 10 }}
        >
          <Text style={{ color: palette.blue, fontWeight: '600' }}>{expanded ? 'Zwiń' : `Pokaż wszystkie (${items.length})`}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  headIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '700' },
  card: { borderRadius: 16, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  icon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  callBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: '#34C759', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginTop: 8 },
});

import React from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LUX_SERIF } from './luxTheme';

/** Czarny nagłówek: logo, biuro, powitanie, postęp i karta agenta — jak na www. */
export default function LuxHeader({
  insetsTop,
  onBack,
  greeting,
  headline,
  done,
  total,
  agencyName,
  agencyLogo,
  agentName,
  agentPhoto,
  agentTitle,
  agentPhone,
  partnerName,
  onChat,
  unread,
  children,
}: {
  insetsTop: number;
  onBack: () => void;
  greeting: string;
  headline: string;
  done: number;
  total: number;
  agencyName: string;
  agencyLogo?: string | null;
  agentName: string;
  agentPhoto?: string | null;
  agentTitle?: string | null;
  agentPhone?: string | null;
  partnerName?: string | null;
  onChat: () => void;
  unread?: number;
  children?: React.ReactNode;
}) {
  const phone = String(agentPhone || '').replace(/[^\d+]/g, '');
  const monogram = (agencyName || 'E').trim().charAt(0).toUpperCase();
  return (
    <View style={[styles.wrap, { paddingTop: insetsTop + 8 }]}>
      <View style={styles.top}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.round}>
          <Ionicons name="chevron-back" size={20} color="#D8C3A0" />
        </Pressable>
        <View style={styles.brand}>
          <Image source={require('../../../../assets/logo.png')} style={styles.logo} />
          <Text style={styles.brandName}>EstateOS</Text>
        </View>
        <Pressable onPress={onChat} hitSlop={12} style={styles.round}>
          <Ionicons name="chatbubble-ellipses-outline" size={18} color="#D8C3A0" />
          {unread ? <View style={styles.badge} /> : null}
        </Pressable>
      </View>

      <View style={styles.agency}>
        {agencyLogo ? (
          <Image source={{ uri: agencyLogo }} style={styles.agencyLogo} resizeMode="contain" />
        ) : (
          <View style={styles.monogram}>
            <Text style={{ fontFamily: LUX_SERIF, color: '#D8C3A0', fontSize: 15 }}>{monogram}</Text>
          </View>
        )}
        <Text style={styles.agencyName} numberOfLines={1}>
          {agencyName}
        </Text>
      </View>

      <Text style={styles.greeting}>
        {greeting}
        {partnerName ? ` · ${partnerName}` : ''}
      </Text>
      <Text style={styles.headline}>{headline}</Text>

      <View style={styles.bar}>
        {Array.from({ length: Math.max(1, total) }).map((_, i) => (
          <View key={i} style={[styles.barSeg, { backgroundColor: i < done ? '#D8C3A0' : i === done ? 'rgba(216,195,160,0.5)' : 'rgba(255,255,255,0.12)' }]} />
        ))}
      </View>
      <Text style={styles.barLabel}>
        Etap {Math.min(done + 1, total)} z {total}
      </Text>

      {children}

      <View style={styles.agent}>
        {agentPhoto ? (
          <Image source={{ uri: agentPhoto }} style={styles.agentPhoto} />
        ) : (
          <View style={[styles.agentPhoto, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#1F1F21' }]}>
            <Ionicons name="person" size={20} color="#D8C3A0" />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.agentName} numberOfLines={1}>
            {agentName}
          </Text>
          <Text style={styles.agentTitle} numberOfLines={1}>
            {agentTitle || 'Twój agent'}
          </Text>
        </View>
        {phone ? (
          <Pressable onPress={() => void Linking.openURL(`tel:${phone}`)} style={styles.agentBtn} hitSlop={8}>
            <Ionicons name="call" size={16} color="#000" />
          </Pressable>
        ) : null}
        <Pressable onPress={onChat} style={[styles.agentBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(216,195,160,0.4)' }]} hitSlop={8}>
          <Ionicons name="chatbubble" size={15} color="#D8C3A0" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#000', paddingHorizontal: 20, paddingBottom: 22, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  round: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: 'rgba(216,195,160,0.35)', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 6, right: 7, width: 8, height: 8, borderRadius: 4, backgroundColor: '#E5484D' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 24, height: 24, borderRadius: 6 },
  brandName: { color: '#F6F3EE', fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  agency: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 },
  agencyLogo: { height: 30, width: 90, backgroundColor: '#fff', borderRadius: 6 },
  monogram: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: '#D8C3A0', alignItems: 'center', justifyContent: 'center' },
  agencyName: { color: '#BDB6AA', fontSize: 13, fontWeight: '700', letterSpacing: 0.4, flex: 1 },
  greeting: { color: '#BDB6AA', fontSize: 15, marginTop: 18 },
  headline: { fontFamily: LUX_SERIF, color: '#F6F3EE', fontSize: 30, lineHeight: 36, marginTop: 6 },
  bar: { flexDirection: 'row', gap: 4, marginTop: 18 },
  barSeg: { flex: 1, height: 4, borderRadius: 2 },
  barLabel: { color: '#8C877D', fontSize: 12, marginTop: 7, fontWeight: '600' },
  agent: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, padding: 12, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(216,195,160,0.18)' },
  agentPhoto: { width: 44, height: 44, borderRadius: 22 },
  agentName: { color: '#F6F3EE', fontSize: 15, fontWeight: '700' },
  agentTitle: { color: '#8C877D', fontSize: 12, marginTop: 2 },
  agentBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#D8C3A0', alignItems: 'center', justifyContent: 'center' },
});

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../store/useAuthStore';
import { API_URL } from '../../config/network';
import type { AgencyMembershipSnapshot } from '../../types/agencyMembership';

type Props = {
  membership: AgencyMembershipSnapshot;
  isDark: boolean;
};

function resolveLogoUrl(logoUrl?: string | null) {
  const raw = String(logoUrl || '').trim();
  if (!raw) return null;
  return raw.startsWith('/') ? `${API_URL}${raw}` : raw;
}

export default function ProfileAgencyOfficeCard({ membership, isDark }: Props) {
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);

  const company = membership.company;
  const companyName = membership.companyName || company?.name || user?.companyName || 'Biuro nieruchomości';
  const logoUrl = resolveLogoUrl(company?.logoUrl || user?.companyLogoUrl);
  const activeCount =
    membership.stats?.activeMembers ?? membership.team?.filter((m) => m.status === 'ACTIVE').length ?? 0;
  const pendingCount =
    membership.stats?.pendingMembers ?? membership.team?.filter((m) => m.status === 'PENDING').length ?? 0;
  const isAdmin = membership.role === 'ADMIN' && membership.status === 'ACTIVE';
  const titleLabel = membership.titleLabel || (isAdmin ? 'Kierownik biura' : 'Agent');

  const subtitle = useMemo(() => {
    if (membership.status === 'PENDING') return 'Oczekuje na akceptację przez kierownika biura';
    if (isAdmin && pendingCount > 0) return `${activeCount} aktywnych · ${pendingCount} oczekujących`;
    return `${activeCount} pracowników w zespole`;
  }, [membership.status, isAdmin, pendingCount, activeCount]);

  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const border = isDark ? 'rgba(84,84,88,0.45)' : 'rgba(60,60,67,0.12)';
  const text = isDark ? '#FFFFFF' : '#000000';
  const secondary = isDark ? '#8E8E93' : '#6C6C70';

  return (
    <Pressable
      onPress={() => navigation.navigate('AgencyOffice')}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: cardBg, borderColor: border, opacity: pressed ? 0.92 : 1 },
      ]}
    >
      <View style={styles.row}>
        <View style={[styles.logoShell, { borderColor: border, backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.logo} contentFit="cover" />
          ) : (
            <Ionicons name="business" size={28} color={isDark ? '#64D2FF' : '#007AFF'} />
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.eyebrow, { color: secondary }]}>MOJE BIURO</Text>
          <Text style={[styles.companyName, { color: text }]} numberOfLines={2}>
            {companyName}
          </Text>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: isDark ? 'rgba(52,199,89,0.18)' : 'rgba(52,199,89,0.12)' }]}>
              <Text style={styles.badgeText}>{titleLabel}</Text>
            </View>
            {isAdmin ? (
              <View style={[styles.badge, { backgroundColor: isDark ? 'rgba(255,149,0,0.18)' : 'rgba(255,149,0,0.12)' }]}>
                <Text style={[styles.badgeText, { color: '#FF9500' }]}>Administrator</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.subtitle, { color: secondary }]} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={secondary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoShell: {
    width: 56,
    height: 56,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: { width: '100%', height: '100%' },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  companyName: { fontSize: 18, fontWeight: '800', marginTop: 2, letterSpacing: -0.3 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#34C759' },
  subtitle: { fontSize: 13, marginTop: 8, lineHeight: 18 },
});

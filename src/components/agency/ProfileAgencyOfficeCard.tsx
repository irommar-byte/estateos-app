import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../store/useAuthStore';
import { API_URL } from '../../config/network';
import type { AgencyMembershipSnapshot } from '../../types/agencyMembership';
import { useI18n } from '../../i18n';

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
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);

  const company = membership.company;
  const companyName = membership.companyName || company?.name || user?.companyName || 'Biuro nieruchomości';
  const logoUrl = resolveLogoUrl(company?.logoUrl || (user as any)?.companyLogoUrl);
  const activeCount =
    membership.stats?.activeMembers ?? membership.team?.filter((m) => m.status === 'ACTIVE').length ?? 0;
  const pendingCount =
    membership.stats?.pendingMembers ?? membership.team?.filter((m) => m.status === 'PENDING').length ?? 0;
  const isPending = Boolean(membership.pendingApproval || membership.status === 'PENDING');
  const isAdmin = membership.role === 'ADMIN' && membership.status === 'ACTIVE';
  const titleLabel = membership.titleLabel || (isAdmin ? 'Kierownik biura' : 'Agent');

  const subtitle = useMemo(() => {
    if (isPending) {
      return t('profile.agency.pendingBody', { company: companyName });
    }
    if (isAdmin && pendingCount > 0) return `${activeCount} aktywnych · ${pendingCount} oczekujących`;
    return `${activeCount} pracowników w zespole`;
  }, [isPending, companyName, t, isAdmin, pendingCount, activeCount]);

  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const border = isPending
    ? isDark
      ? 'rgba(255,159,10,0.45)'
      : 'rgba(255,159,10,0.35)'
    : isDark
      ? 'rgba(84,84,88,0.45)'
      : 'rgba(60,60,67,0.12)';
  const text = isDark ? '#FFFFFF' : '#000000';
  const secondary = isDark ? '#8E8E93' : '#6C6C70';

  return (
    <Pressable
      onPress={() => {
        if (isPending) return;
        navigation.navigate('AgencyOffice');
      }}
      disabled={isPending}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: cardBg,
          borderColor: border,
          opacity: pressed && !isPending ? 0.92 : 1,
        },
      ]}
    >
      <View style={styles.row}>
        <View style={[styles.logoShell, { borderColor: border, backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.logo} contentFit="cover" />
          ) : (
            <Ionicons name="business" size={28} color={isPending ? '#FF9F0A' : isDark ? '#64D2FF' : '#007AFF'} />
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.eyebrow, { color: secondary }]}>MOJE BIURO</Text>
          <Text style={[styles.companyName, { color: text }]} numberOfLines={2}>
            {companyName}
          </Text>
          <View style={styles.badgeRow}>
            {isPending ? (
              <View style={[styles.badge, { backgroundColor: isDark ? 'rgba(255,159,10,0.22)' : 'rgba(255,159,10,0.16)' }]}>
                <Text style={[styles.badgeText, { color: '#FF9F0A' }]}>{t('profile.agency.pendingBadge')}</Text>
              </View>
            ) : (
              <View style={[styles.badge, { backgroundColor: isDark ? 'rgba(52,199,89,0.18)' : 'rgba(52,199,89,0.12)' }]}>
                <Text style={styles.badgeText}>{titleLabel}</Text>
              </View>
            )}
            {isAdmin ? (
              <View style={[styles.badge, { backgroundColor: isDark ? 'rgba(255,149,0,0.18)' : 'rgba(255,149,0,0.12)' }]}>
                <Text style={[styles.badgeText, { color: '#FF9500' }]}>Administrator</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.subtitle, { color: secondary }]} numberOfLines={3}>
            {subtitle}
          </Text>
          {isPending ? (
            <Text style={[styles.browseHint, { color: secondary }]} numberOfLines={3}>
              {t('profile.agency.pendingBrowseHint')}
            </Text>
          ) : null}
        </View>
        {isPending ? null : <Ionicons name="chevron-forward" size={20} color={secondary} />}
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
  browseHint: { fontSize: 12, marginTop: 6, lineHeight: 17 },
});

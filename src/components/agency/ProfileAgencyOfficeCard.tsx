import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../store/useAuthStore';
import { API_URL } from '../../config/network';
import type { AgencyMembershipSnapshot } from '../../types/agencyMembership';
import { useI18n } from '../../i18n';
import MobilePulseScheduleWidget from './MobilePulseScheduleWidget';

type Props = {
  membership: AgencyMembershipSnapshot;
  isDark: boolean;
  embedded?: boolean;
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

  if (embedded) {
    return (
      <View style={{ marginTop: 14 }}>
        <View
          style={{
            height: StyleSheet.hairlineWidth,
            backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)',
            marginBottom: 12,
          }}
        />
        <Pressable
          onPress={() => {
            if (isPending) return;
            navigation.navigate('AgencyOffice');
          }}
          disabled={isPending}
          style={({ pressed }) => [{ opacity: pressed && !isPending ? 0.88 : 1 }]}
        >
          <View style={styles.row}>
            <View style={[styles.logoShell, { borderColor: border, backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}>
              {logoUrl ? (
                <Image source={{ uri: logoUrl }} style={styles.logo} contentFit="cover" />
              ) : (
                <Ionicons name="business" size={26} color={isPending ? '#FF9F0A' : isDark ? '#64D2FF' : '#007AFF'} />
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.eyebrow, { color: secondary }]}>MOJE BIURO</Text>
              <Text style={[styles.companyName, { color: text }]} numberOfLines={1}>
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
              </View>
              <Text style={[styles.subtitle, { color: secondary }]} numberOfLines={1}>
                {subtitle}
              </Text>
            </View>
            {!isPending && isAdmin && pendingCount > 0 ? (
              <View style={styles.pendingBubble}>
                <Text style={styles.pendingBubbleText}>{pendingCount > 99 ? '99+' : String(pendingCount)}</Text>
              </View>
            ) : null}
            {isPending ? null : <Ionicons name="chevron-forward" size={18} color={secondary} />}
          </View>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: cardBg,
          borderColor: border,
        },
      ]}
    >
      <Pressable
        onPress={() => {
          if (isPending) return;
          navigation.navigate('AgencyOffice');
        }}
        disabled={isPending}
        style={({ pressed }) => [{ opacity: pressed && !isPending ? 0.92 : 1 }]}
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
          <Text style={[styles.companyName, { color: text }]}>
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
          <Text style={[styles.subtitle, { color: secondary }]}>
            {subtitle}
          </Text>
          {isPending ? (
            <Text style={[styles.browseHint, { color: secondary }]}>
              {t('profile.agency.pendingBrowseHint')}
            </Text>
          ) : null}
        </View>
        {!isPending && isAdmin && pendingCount > 0 ? (
          <View style={styles.pendingBubble}>
            <Text style={styles.pendingBubbleText}>{pendingCount > 99 ? '99+' : String(pendingCount)}</Text>
          </View>
        ) : null}
        {isPending ? null : <Ionicons name="chevron-forward" size={20} color={secondary} />}
      </View>
      </Pressable>
      {!isPending ? (
        <>
          <View style={styles.actions}>
            <Pressable
              onPress={() => navigation.navigate('AgencyClientCreate')}
              style={[styles.actionBtn, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}
            >
              <Ionicons name="person-add" size={16} color="#34C759" />
              <Text style={[styles.actionText, { color: text }]}>Dodaj klienta</Text>
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('AgencyClients')}
              style={[styles.actionBtn, { backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7' }]}
            >
              <Ionicons name="people" size={16} color="#007AFF" />
              <Text style={[styles.actionText, { color: text }]}>Moi klienci</Text>
            </Pressable>
          </View>

          {/* CRM Schedule Widget embedded directly in Moje Biuro */}
          <MobilePulseScheduleWidget isDark={isDark} />
        </>
      ) : null}
    </View>
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
  pendingBubble: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF3B30',
    shadowColor: '#FF3B30',
    shadowOpacity: 0.55,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  pendingBubbleText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 14,
  },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionText: { fontSize: 13, fontWeight: '800' },
});

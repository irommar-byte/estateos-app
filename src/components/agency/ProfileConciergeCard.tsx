import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../store/useAuthStore';
import { fetchLeadTransfers } from '../../services/leadTransferService';

type Props = {
  isDark: boolean;
  isAgency: boolean;
};

export default function ProfileConciergeCard({ isDark, isAgency }: Props) {
  const navigation = useNavigation<any>();
  const token = useAuthStore((s) => s.token);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) {
      setPendingCount(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const leads = await fetchLeadTransfers(token);
      const pending = leads.filter((l) =>
        isAgency
          ? ['PENDING', 'USER_COUNTER'].includes(l.status)
          : ['TERMS_PROPOSED', 'USER_COUNTER'].includes(l.status),
      );
      setPendingCount(pending.length);
    } finally {
      setLoading(false);
    }
  }, [token, isAgency]);

  useEffect(() => {
    void load();
  }, [load]);

  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const border = isDark ? 'rgba(84,84,88,0.45)' : 'rgba(60,60,67,0.12)';
  const text = isDark ? '#FFFFFF' : '#000000';
  const secondary = isDark ? '#8E8E93' : '#6C6C70';

  return (
    <Pressable
      onPress={() => navigation.navigate('AgencyLeadInbox')}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: cardBg, borderColor: border, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="briefcase" size={22} color="#FF9500" />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: secondary, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>
          CONCIERGE
        </Text>
        <Text style={{ color: text, fontSize: 17, fontWeight: '800', marginTop: 2 }}>
          {isAgency ? 'Zapytania o przejęcie' : 'Przekazanie do agencji'}
        </Text>
        <Text style={{ color: secondary, fontSize: 12, marginTop: 4 }} numberOfLines={2}>
          {isAgency
            ? 'Podgląd ofert i warunki współpracy dla właścicieli.'
            : 'Warunki od agencji, akceptacja i podgląd sprzedaży.'}
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator color="#FF9500" />
      ) : pendingCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{pendingCount}</Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={20} color={secondary} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 14,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,149,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FF9500',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  badgeText: { color: '#000', fontWeight: '900', fontSize: 12 },
});

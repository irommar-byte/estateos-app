import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../../store/useAuthStore';
import { fetchLeadTransfers } from '../../services/leadTransferService';
import { countPendingConciergeLeads } from '../../types/leadTransfer';

type Props = {
  isDark: boolean;
  isAgency: boolean;
  embedded?: boolean;
};

export default function ProfileConciergeCard({ isDark, isAgency, embedded }: Props) {
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
      setPendingCount(countPendingConciergeLeads(leads, isAgency));
    } finally {
      setLoading(false);
    }
  }, [token, isAgency]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    const refreshSub = Notifications.addNotificationReceivedListener((notification) => {
      const data = (notification?.request?.content?.data || {}) as Record<string, unknown>;
      if (String(data.kind || data.notificationType || '').toLowerCase() !== 'concierge_lead') return;
      void load();
    });
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
    });
    return () => {
      refreshSub.remove();
      appSub.remove();
    };
  }, [load]);

  const cardBg = embedded ? 'transparent' : isDark ? '#1C1C1E' : '#FFFFFF';
  const border = embedded ? 'transparent' : isDark ? 'rgba(84,84,88,0.45)' : 'rgba(60,60,67,0.12)';
  const text = isDark ? '#FFFFFF' : '#000000';
  const secondary = isDark ? '#8E8E93' : '#6C6C70';

  return (
    <Pressable
      onPress={() => navigation.navigate('AgencyLeadInbox')}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: cardBg,
          borderColor: border,
          borderWidth: embedded ? 0 : StyleSheet.hairlineWidth,
          marginBottom: embedded ? 0 : 14,
          padding: embedded ? 0 : 14,
          opacity: pressed ? 0.9 : 1,
        },
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
          <Text style={styles.badgeText}>{pendingCount > 9 ? '9+' : pendingCount}</Text>
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
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    shadowColor: '#FF3B30',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  badgeText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
});

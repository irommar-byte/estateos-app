import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import MobilePulseScheduleWidget from './MobilePulseScheduleWidget';
import ProfileConciergeCard from './ProfileConciergeCard';

type Props = {
  isDark: boolean;
  isAgency: boolean;
};

export default function ProfileCrmSection({ isDark, isAgency }: Props) {
  const navigation = useNavigation<any>();

  const cardBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const border = isDark ? 'rgba(84,84,88,0.45)' : 'rgba(60,60,67,0.12)';
  const text = isDark ? '#FFFFFF' : '#000000';
  const secondary = isDark ? '#8E8E93' : '#6C6C70';
  const actionBg = isDark ? '#2C2C2E' : '#F2F2F7';

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
      {/* Section Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.brandDot} />
          <Text style={[styles.sectionTitle, { color: text }]}>EstateOS™ CRM</Text>
        </View>
        <View style={[styles.crmBadge, { backgroundColor: isDark ? 'rgba(52,199,89,0.18)' : 'rgba(52,199,89,0.12)' }]}>
          <Text style={styles.crmBadgeText}>AKTYWNY</Text>
        </View>
      </View>

      {/* Quick Action Buttons */}
      <View style={styles.actionsRow}>
        <Pressable
          onPress={() => navigation.navigate('AgencyClientCreate')}
          style={({ pressed }) => [
            styles.actionBtn,
            { backgroundColor: actionBg, opacity: pressed ? 0.88 : 1 },
          ]}
        >
          <Ionicons name="person-add" size={17} color="#34C759" />
          <Text style={[styles.actionText, { color: text }]}>Dodaj klienta</Text>
        </Pressable>

        <Pressable
          onPress={() => navigation.navigate('AgencyClients')}
          style={({ pressed }) => [
            styles.actionBtn,
            { backgroundColor: actionBg, opacity: pressed ? 0.88 : 1 },
          ]}
        >
          <Ionicons name="people" size={17} color="#007AFF" />
          <Text style={[styles.actionText, { color: text }]}>Moi klienci</Text>
        </Pressable>
      </View>

      {/* CRM Schedule Widget */}
      <MobilePulseScheduleWidget isDark={isDark} />

      {/* Concierge Lead Transfers Row */}
      <View style={styles.conciergeContainer}>
        <ProfileConciergeCard isDark={isDark} isAgency={isAgency} embedded />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34C759',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  crmBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  crmBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#34C759',
    letterSpacing: 0.6,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '800',
  },
  conciergeContainer: {
    marginTop: 6,
  },
});

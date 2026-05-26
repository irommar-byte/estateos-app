import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Briefcase, User } from 'lucide-react-native';
import EliteStatusBadges from './EliteStatusBadges';
import {
  getBestUserAvatarUrl,
  isAgencyUser,
  resolveAgencyDisplayName,
} from '../utils/userAvatar';

type Props = {
  user: unknown;
  idLabel?: string;
  isDark?: boolean;
};

export default function ProfilePublicHeader({ user, idLabel, isDark = true }: Props) {
  const avatarUrl = getBestUserAvatarUrl(user);
  const agency = isAgencyUser(user) ? resolveAgencyDisplayName(user) : null;
  const name =
    String((user as { name?: string })?.name ?? '').trim() || 'Użytkownik';

  return (
    <View style={styles.wrap}>
      <View style={styles.avatarShell}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatarPlaceholder, isDark && styles.avatarPlaceholderDark]}>
            {agency ? (
              <Briefcase size={26} color={isDark ? '#93c5fd' : '#2563eb'} />
            ) : (
              <User size={26} color={isDark ? '#9ca3af' : '#6b7280'} />
            )}
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, isDark && styles.nameDark]} numberOfLines={2}>
          {name}
        </Text>
        {agency ? (
          <Text style={[styles.agency, isDark && styles.agencyDark]} numberOfLines={2}>
            {agency}
          </Text>
        ) : null}
        <EliteStatusBadges subject={user} isDark={isDark} compact />
        {idLabel ? (
          <Text style={[styles.idMeta, isDark && styles.idMetaDark]}>{idLabel}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
  },
  avatarShell: {
    width: 64,
    height: 64,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  avatar: { width: '100%', height: '100%' },
  avatarPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  avatarPlaceholderDark: { backgroundColor: '#111827' },
  info: { flex: 1, minWidth: 0 },
  name: { color: '#111827', fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  nameDark: { color: '#fff' },
  agency: {
    color: '#2563eb',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
    marginBottom: 4,
  },
  agencyDark: { color: '#93c5fd' },
  idMeta: { color: '#6b7280', fontSize: 11, marginTop: 4 },
  idMetaDark: { color: '#9ca3af' },
});

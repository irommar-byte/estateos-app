import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { getActivePortalToken, listPortalSessions, type StoredPortalSession } from '../lib/clientPortalSession';
import { useThemeStore } from '../store/useThemeStore';

export default function ProfileClientPortalCard() {
  const navigation = useNavigation<any>();
  const isDark = useThemeStore((s) => s.getResolvedTheme() === 'dark');
  const [session, setSession] = useState<StoredPortalSession | null>(null);

  useEffect(() => {
    void (async () => {
      const sessions = await listPortalSessions();
      const active = await getActivePortalToken();
      setSession(sessions.find((row) => row.token === active) || sessions[0] || null);
    })();
  }, []);

  if (!session) return null;

  const bg = isDark ? '#1C1C1E' : '#FFFFFF';
  const text = isDark ? '#F5F5F7' : '#111827';
  const muted = isDark ? 'rgba(255,255,255,0.55)' : '#6B7280';

  return (
    <Pressable
      onPress={() => navigation.navigate('ClientPortal', { portalToken: session.token })}
      style={[styles.card, { backgroundColor: bg }]}
    >
      <View style={styles.icon}>
        <Ionicons name="home-outline" size={18} color="#059669" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: text }]}>Twój panel od agenta</Text>
        <Text style={[styles.sub, { color: muted }]} numberOfLines={1}>
          {session.agencyName || 'EstateOS'} {session.clientName ? `· ${session.clientName}` : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(5,150,105,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontWeight: '800', fontSize: 15 },
  sub: { marginTop: 2, fontSize: 12 },
});

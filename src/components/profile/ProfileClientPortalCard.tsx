import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import ProfileCardShell from './ProfileCardShell';
import { getActivePortalToken, listPortalSessions, type StoredPortalSession } from '../../lib/clientPortalSession';
import { useThemeStore } from '../../store/useThemeStore';

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

  const text = isDark ? '#FFFFFF' : '#000000';
  const muted = isDark ? '#8E8E93' : '#6C6C70';

  return (
    <View style={styles.wrap}>
      <ProfileCardShell isDark={isDark} faceStyle={{ padding: 16 }}>
        <Pressable
          onPress={() => navigation.navigate('ClientPortal', { portalToken: session.token })}
          style={styles.row}
        >
          <View style={styles.icon}>
            <Ionicons name="home-outline" size={18} color="#34C759" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: text }]}>Twój panel od agenta</Text>
            <Text style={[styles.sub, { color: muted }]} numberOfLines={1}>
              {session.agencyName || 'EstateOS'}
              {session.clientName ? ` · ${session.clientName}` : ''}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={muted} />
        </Pressable>
      </ProfileCardShell>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginTop: 12, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(52,199,89,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontWeight: '700', fontSize: 15 },
  sub: { marginTop: 2, fontSize: 12 },
});

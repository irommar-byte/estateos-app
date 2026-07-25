import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { getBestUserAvatarUrl } from '../../utils/userAvatar';

type Props = {
  name: string;
  peer?: { image?: string | null; name?: string | null; email?: string | null } | null;
  size?: number;
  isDark?: boolean;
  isOnline?: boolean;
};

function initialsFromName(name: string): string {
  return (
    String(name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || '')
      .join('') || '?'
  );
}

export default function ContactPeerAvatar({
  name,
  peer,
  size = 46,
  isDark = true,
  isOnline = false,
}: Props) {
  const uri = getBestUserAvatarUrl(peer ?? { name });
  const radius = Math.round(size * 0.3);
  const dot = Math.max(10, Math.round(size * 0.28));

  return (
    <View style={{ width: size, height: size }}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: radius }}
          contentFit="cover"
          transition={120}
        />
      ) : (
        <View
          style={[
            styles.fallback,
            {
              width: size,
              height: size,
              borderRadius: radius,
              backgroundColor: isDark ? 'rgba(52,199,89,0.18)' : 'rgba(52,199,89,0.12)',
            },
          ]}
        >
          <Text style={[styles.fallbackText, { fontSize: Math.round(size * 0.32) }]}>
            {initialsFromName(name)}
          </Text>
        </View>
      )}
      {isOnline ? (
        <View
          style={[
            styles.onlineDot,
            {
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              borderColor: isDark ? '#1C1C1E' : '#FFFFFF',
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    color: '#34C759',
    fontWeight: '800',
  },
  onlineDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    backgroundColor: '#34C759',
    borderWidth: 2,
  },
});

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { getBestUserAvatarUrl } from '../../utils/userAvatar';

type Props = {
  name: string;
  peer?: { image?: string | null; name?: string | null; email?: string | null } | null;
  size?: number;
  isDark?: boolean;
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

export default function ContactPeerAvatar({ name, peer, size = 46, isDark = true }: Props) {
  const uri = getBestUserAvatarUrl(peer ?? { name });
  const radius = Math.round(size * 0.3);

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: radius }}
        contentFit="cover"
        transition={120}
      />
    );
  }

  return (
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
});

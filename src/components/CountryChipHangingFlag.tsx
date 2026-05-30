import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { CountryCode } from 'libphonenumber-js';
import UserRegionFlag from './UserRegionFlag';

type Props = {
  iso: string;
  isDark?: boolean;
};

/** Trójwymiarowa flaga „wisząca” w prawym górnym rogu chipa filtra państwa. */
export default function CountryChipHangingFlag({ iso, isDark }: Props) {
  const code = String(iso || '')
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;

  return (
    <View style={styles.hang} pointerEvents="none">
      <View style={styles.pole} />
      <UserRegionFlag fallbackIso={code as CountryCode} size={20} animated isDark={isDark} />
    </View>
  );
}

const styles = StyleSheet.create({
  hang: {
    position: 'absolute',
    top: -22,
    right: 0,
    zIndex: 4,
    alignItems: 'center',
  },
  pole: {
    width: 2,
    height: 8,
    borderRadius: 1,
    backgroundColor: 'rgba(120,120,128,0.55)',
    marginBottom: -1,
  },
});

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

/** Znaczek na kafelku galerii: plik ma prawdziwy HDR (gain map), nie Display P3. */
export default function HdrPreviewBadge() {
  return (
    <View style={styles.badge} accessibilityLabel="Zdjęcie HDR">
      <Text style={styles.text}>HDR</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 6,
    left: 6,
    zIndex: 12,
    backgroundColor: 'rgba(0,0,0,0.74)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(253, 230, 138, 0.4)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  text: {
    color: '#fef3c7',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
});

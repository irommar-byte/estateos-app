import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LUX_SERIF, type LuxPalette } from './luxTheme';

export type LuxTool = { key: string; title: string; description: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void; badge?: string };

export default function LuxTools({ kicker, title, tools, palette }: { kicker: string; title: string; tools: LuxTool[]; palette: LuxPalette }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.6, color: palette.accent }}>{kicker.toUpperCase()}</Text>
      <Text style={{ fontFamily: LUX_SERIF, fontSize: 24, color: palette.ink, marginTop: 4, marginBottom: 12 }}>{title}</Text>
      <View style={styles.grid}>
        {tools.map((tool) => (
          <Pressable
            key={tool.key}
            onPress={() => {
              void Haptics.selectionAsync();
              tool.onPress();
            }}
            style={({ pressed }) => [styles.tile, { backgroundColor: palette.card, borderColor: palette.border, opacity: pressed ? 0.85 : 1 }]}
          >
            <View style={[styles.icon, { backgroundColor: palette.isDark ? '#2A2620' : '#000' }]}>
              <Ionicons name={tool.icon} size={18} color="#D8C3A0" />
            </View>
            {tool.badge ? (
              <View style={[styles.badge, { backgroundColor: palette.accent }]}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{tool.badge}</Text>
              </View>
            ) : null}
            <Text style={{ fontSize: 15, fontWeight: '800', color: palette.ink, marginTop: 12 }}>{tool.title}</Text>
            <Text style={{ fontSize: 12, color: palette.muted, marginTop: 3, lineHeight: 16 }} numberOfLines={2}>
              {tool.description}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48%', flexGrow: 1, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 14, minHeight: 128 },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 12, right: 12, minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
});

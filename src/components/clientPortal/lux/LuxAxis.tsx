import React, { useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LUX_SERIF, type LuxPalette } from './luxTheme';

export type LuxStage = {
  id: string;
  label: string;
  state: 'done' | 'current' | 'future';
  summary?: React.ReactNode;
  content?: React.ReactNode;
};

/** Pionowa oś podróży: etapy zrobione, bieżący (rozwinięty) i przyszłe. */
export default function LuxAxis({ title, stages, palette }: { title: string; stages: LuxStage[]; palette: LuxPalette }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const currentId = stages.find((s) => s.state === 'current')?.id || null;
  const expandedId = openId ?? currentId;
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={[styles.kicker, { color: palette.accent }]}>OŚ PODRÓŻY</Text>
      <Text style={{ fontFamily: LUX_SERIF, fontSize: 26, color: palette.ink, marginTop: 4, marginBottom: 14 }}>{title}</Text>
      {stages.map((stage, index) => {
        const last = index === stages.length - 1;
        const expanded = expandedId === stage.id && Boolean(stage.content);
        const dotColor = stage.state === 'done' ? palette.accent : stage.state === 'current' ? palette.ink : palette.border;
        return (
          <View key={stage.id} style={styles.row}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: stage.state === 'future' ? palette.bg : dotColor,
                    borderColor: dotColor,
                    width: stage.state === 'current' ? 18 : 14,
                    height: stage.state === 'current' ? 18 : 14,
                    borderRadius: 9,
                  },
                ]}
              >
                {stage.state === 'done' ? <Ionicons name="checkmark" size={9} color={palette.isDark ? '#000' : '#fff'} /> : null}
              </View>
              {!last ? <View style={[styles.line, { backgroundColor: stage.state === 'done' ? palette.accent : palette.border }]} /> : null}
            </View>
            <View style={{ flex: 1, paddingBottom: last ? 4 : 18 }}>
              <Pressable
                onPress={() => {
                  if (!stage.content) return;
                  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                  setOpenId(expanded ? '__none' : stage.id);
                }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <Text
                  style={{
                    flex: 1,
                    fontSize: stage.state === 'current' ? 18 : 15,
                    fontWeight: stage.state === 'current' ? '800' : '700',
                    color: stage.state === 'future' ? palette.muted : palette.ink,
                  }}
                >
                  {stage.label}
                </Text>
                {stage.state === 'current' ? (
                  <View style={[styles.now, { backgroundColor: palette.isDark ? palette.gold : palette.black }]}>
                    <Text style={{ color: palette.isDark ? '#000' : palette.gold, fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>TERAZ</Text>
                  </View>
                ) : null}
                {stage.content ? <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={palette.muted} /> : null}
              </Pressable>
              {stage.summary ? <View style={{ marginTop: 4 }}>{typeof stage.summary === 'string' ? <Text style={{ fontSize: 13, color: palette.muted, lineHeight: 18 }}>{stage.summary}</Text> : stage.summary}</View> : null}
              {expanded ? <View style={{ marginTop: 12, gap: 10 }}>{stage.content}</View> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  row: { flexDirection: 'row', gap: 14 },
  rail: { width: 18, alignItems: 'center' },
  dot: { borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 3 },
  line: { width: 2, flex: 1, marginTop: 4, borderRadius: 1 },
  now: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
});

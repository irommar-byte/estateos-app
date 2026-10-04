import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { PresentationBrief } from '../../lib/presentationBrief';

export default function PresentationBriefView({ brief }: { brief: PresentationBrief }) {
  return (
    <View>
      <Text style={styles.kicker}>ŚCIĄGA NA PREZENTACJĘ</Text>
      <Text style={styles.title}>{brief.headline}</Text>
      <Text style={styles.lead}>
        Mów etapami, od wejścia do zamknięcia. Pod spodem są wszystkie parametry tej oferty.
      </Text>

      {brief.stages.map((stage) => (
        <View key={stage.step} style={styles.stage}>
          <View style={styles.stageHead}>
            <Text style={styles.step}>{stage.step}</Text>
            <Text style={styles.stageTitle}>{stage.title}</Text>
          </View>
          <Text style={styles.label}>PRZEKAŻ</Text>
          {stage.say.map((line) => (
            <Text key={line} style={styles.say}>
              {line}
            </Text>
          ))}
          <Text style={[styles.label, { marginTop: 12 }]}>ZWRÓĆ UWAGĘ</Text>
          {stage.watch.map((line) => (
            <Text key={line} style={styles.watch}>
              {line}
            </Text>
          ))}
        </View>
      ))}

      <Text style={[styles.kicker, { marginTop: 8 }]}>WSZYSTKIE PARAMETRY</Text>
      <View style={styles.grid}>
        {brief.specs.map((spec) => (
          <View key={spec.label} style={styles.spec}>
            <Text style={styles.specLabel}>{spec.label}</Text>
            <Text style={styles.specValue}>{spec.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  kicker: { color: '#8e8e93', fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  title: { color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: -0.6, marginTop: 8 },
  lead: { color: '#a1a1aa', marginTop: 8, fontSize: 15, lineHeight: 22 },
  stage: {
    marginTop: 14,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#141416',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  stageHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  step: { color: '#34C759', fontWeight: '900', fontSize: 13, letterSpacing: 0.6 },
  stageTitle: { color: '#fff', fontWeight: '800', fontSize: 18, flex: 1 },
  label: { color: '#8e8e93', fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 6 },
  say: { color: '#f4f4f5', fontSize: 16, lineHeight: 23, marginBottom: 6 },
  watch: { color: '#fbbf24', fontSize: 14, lineHeight: 20, marginBottom: 4 },
  grid: { marginTop: 10, gap: 8 },
  spec: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#141416',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  specLabel: { color: '#8e8e93', fontSize: 11, fontWeight: '700' },
  specValue: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 2 },
});

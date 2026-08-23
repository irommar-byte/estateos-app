import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export type SmartAddSuggestion = {
  field: string;
  label: string;
  question: string;
  quotes: string[];
};

export default function IntelligenceAmenityPrompt({
  suggestions,
  onDone,
}: {
  suggestions: SmartAddSuggestion[];
  onDone: (decisions: Record<string, boolean>) => void;
}) {
  const queue = useMemo(() => suggestions.filter((item) => item.field), [suggestions]);
  const [index, setIndex] = useState(0);
  const [decisions, setDecisions] = useState<Record<string, boolean>>({});
  const [thanks, setThanks] = useState(false);

  useEffect(() => {
    if (!queue.length) onDone({});
  }, [onDone, queue.length]);

  const current = queue[index];
  if (!current) return null;

  const answer = (yes: boolean) => {
    const next = { ...decisions, [current.field]: yes };
    setDecisions(next);
    if (yes) {
      setThanks(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => {
        setThanks(false);
        if (index + 1 >= queue.length) onDone(next);
        else setIndex((value) => value + 1);
      }, 1100);
      return;
    }
    void Haptics.selectionAsync();
    if (index + 1 >= queue.length) onDone(next);
    else setIndex((value) => value + 1);
  };

  return (
    <Modal transparent animationType="fade" visible>
      <View style={styles.backdrop}>
        <LinearGradient
          colors={['#ff4d6d', '#ffd166', '#06d6a0', '#4cc9f0', '#c77dff']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.frame}
        >
          <View style={styles.card}>
            <LinearGradient
              colors={thanks ? ['#ff4d6d', '#ffd166', '#06d6a0'] : ['#c77dff', '#4cc9f0', '#ff4d6d']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.orb}
            >
              <Ionicons name="sparkles" size={28} color="#fff" />
            </LinearGradient>
            <Text style={styles.kicker}>EstateOS™ Intelligence · Inteligentne dodawanie</Text>
            {thanks ? (
              <Text style={styles.thanks}>Dziękuję. Bingo — naprawione.</Text>
            ) : (
              <>
                <Text style={styles.question}>{current.question}</Text>
                {current.quotes.map((quote) => (
                  <Text key={quote} style={styles.quote}>
                    „{quote}”
                  </Text>
                ))}
                {!current.quotes.length ? (
                  <Text style={styles.meta}>Na podstawie całego opisu ogłoszenia.</Text>
                ) : null}
                <Text style={styles.meta}>
                  {index + 1} / {queue.length} · {current.label}
                </Text>
                <View style={styles.row}>
                  <Pressable onPress={() => answer(false)} style={styles.no}>
                    <Text style={styles.noLabel}>Nie</Text>
                  </Pressable>
                  <Pressable onPress={() => answer(true)} style={styles.yes}>
                    <Text style={styles.yesLabel}>Tak</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  frame: { borderRadius: 28, padding: 2, width: '100%', maxWidth: 420 },
  card: { borderRadius: 26, backgroundColor: '#111', padding: 20, alignItems: 'center' },
  orb: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  kicker: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#c77dff',
    textAlign: 'center',
  },
  question: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 24,
  },
  thanks: {
    marginTop: 18,
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
  },
  quote: {
    marginTop: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 10,
    color: 'rgba(255,255,255,0.88)',
    fontSize: 13,
    lineHeight: 18,
  },
  meta: { marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,0.5)', textAlign: 'center' },
  row: { flexDirection: 'row', gap: 10, marginTop: 18 },
  no: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingVertical: 12,
    alignItems: 'center',
  },
  noLabel: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 0.6, textTransform: 'uppercase' },
  yes: { flex: 1, borderRadius: 999, backgroundColor: '#fff', paddingVertical: 12, alignItems: 'center' },
  yesLabel: { color: '#000', fontWeight: '900', fontSize: 13, letterSpacing: 0.6, textTransform: 'uppercase' },
});

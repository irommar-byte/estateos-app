/**
 * Przycisk dla właściciela po finalnej akceptacji kupującego.
 * Jedyny krok zamykający sprzedaż — nie mylić z „Zgoda” / „Kontroferta”.
 */

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

type Props = {
  amount: number;
  onPress: () => void;
};

export default function OwnerFinalDecisionCta({ amount, onPress }: Props) {
  const glow = useSharedValue(0);

  useEffect(() => {
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }),
        withTiming(0.35, { duration: 900, easing: Easing.in(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [glow]);

  const cardAnim = useAnimatedStyle(() => ({
    borderColor: `rgba(245,197,106,${0.55 + glow.value * 0.45})`,
    shadowOpacity: 0.25 + glow.value * 0.35,
    transform: [{ scale: 1 + glow.value * 0.012 }],
  }));

  const handlePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  const amountLabel =
    amount > 0 ? `${amount.toLocaleString('pl-PL')} PLN` : '—';

  return (
    <View style={styles.wrap}>
      <View style={styles.hintBanner}>
        <Text style={styles.hintTitle}>Twoja kolej — ostatni krok</Text>
        <Text style={styles.hintBody}>
          Kupujący zaakceptował cenę. Aby zamknąć sprzedaż i wycofać ofertę z rynku, dotknij
          zielonego okienka poniżej — nie używaj już przycisków „Zgoda” ani „Kontroferta”.
        </Text>
      </View>

      <Animated.View style={[styles.cardOuter, cardAnim]}>
        <Pressable
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel={`Ostateczna decyzja sprzedaży za ${amountLabel}`}
          accessibilityHint="Otwiera potwierdzenie lub odrzucenie finalnej ceny"
          style={({ pressed }) => [styles.cardPressable, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.eyebrow}>OSTATECZNA DECYZJA SPRZEDAŻY</Text>
          <Text style={styles.amount} numberOfLines={1} adjustsFontSizeToFit>
            {amountLabel}
          </Text>
          <Text style={styles.sub}>Kupujący zaakceptował — Twoje słowo zamyka transakcję</Text>
          <View style={styles.tapRow}>
            <Text style={styles.tapLabel}>Dotknij tego okienka</Text>
            <ChevronRight size={18} color="#F5C56A" strokeWidth={2.5} />
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12, gap: 10 },
  hintBanner: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(245,197,106,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,197,106,0.35)',
  },
  hintTitle: {
    color: '#F5C56A',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  hintBody: {
    color: '#E8E0C8',
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: '500',
  },
  cardOuter: {
    borderRadius: 16,
    borderWidth: 1.6,
    borderColor: 'rgba(245,197,106,0.7)',
    backgroundColor: 'rgba(16,185,129,0.14)',
    shadowColor: '#F5C56A',
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  cardPressable: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  eyebrow: {
    color: '#F5C56A',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  amount: {
    color: '#E7FFEF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginTop: 6,
    fontVariant: ['tabular-nums'],
  },
  sub: {
    color: '#A8DCC0',
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 5,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  tapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(245,197,106,0.35)',
    alignSelf: 'stretch',
  },
  tapLabel: {
    color: '#F5C56A',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});

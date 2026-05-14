/**
 * ====================================================================
 *  EstateOS™ — „Czekamy na decyzję" — neon pulsujący jak bicie serca
 * ====================================================================
 *
 *  Pokazuje się dla KUPUJĄCEGO, gdy wysłał on do właściciela ofertę
 *  z notą „Akceptuję Twoją cenę. Proszę o ostateczne potwierdzenie sprzedaży."
 *  To stan w którym to TYLKO właściciel musi nacisnąć przycisk — kupujący
 *  nie ma nic do zrobienia poza czekaniem.
 *
 *  ZAMIAST stać i myśleć „dlaczego dwa przyciski Zgoda/Kontroferta tu są,
 *  skoro już zaakceptowałem?" — kupujący widzi spokojny, pulsujący neon
 *  „CZEKAMY NA DECYZJĘ WŁAŚCICIELA" z animacją odwzorowującą bicie serca.
 *
 *  Animacja jest świadomie „lubsky-doublepulse" — dwa krótkie pulsy
 *  i pauza, tak jak w EKG (LUB-DUB ... LUB-DUB ...). Robi to dwa rzeczy:
 *    1. budzi spokój (rytm 60–70 BPM = bicie serca w stanie odprężenia),
 *    2. jasno komunikuje „czekamy, ale system żyje i działa".
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

type Props = {
  /**
   * Kwota, na którą czekamy potwierdzenie. Jeśli podana — pokazujemy ją
   * w środku „neonu" delikatnym tekstem („Cena: 821 600 PLN").
   */
  amount?: number | null;
  /** Komunikat główny. Domyślnie „Czekamy na ostateczną decyzję właściciela". */
  headline?: string;
  /** Drobny dopisek pod nagłówkiem. Domyślnie krótka instrukcja co dalej. */
  sublabel?: string;
};

export default function HeartbeatWaitingPulse({ amount, headline, sublabel }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    /**
     * Sekwencja jednego „bicia serca" (~1.1 s):
     *   • LUB     (puls 1, 110 ms, ramp w górę)
     *   • spadek  (90 ms ramp w dół)
     *   • DUB     (puls 2, krótszy/słabszy — 110 ms)
     *   • spadek  (140 ms ramp w dół)
     *   • pauza   (~650 ms płaskie zero)
     * Loopujemy bezterminowo. Animacja jest na `useNativeDriver`, więc
     * idzie po UI thread'zie i nie blokuje gestów / scrolla.
     */
    const heartbeat = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 110,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 90,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.78,
          duration: 110,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 140,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(650),
      ]),
    );
    heartbeat.start();
    return () => heartbeat.stop();
  }, [pulse]);

  // Animacje pochodne: scale, opacity korpusu i jego halo, jasność tekstu.
  // Każdy parametr ma własną krzywą (różne `outputRange`), żeby światło,
  // tekst i ramka pulsowały DELIKATNIE inaczej — wtedy efekt jest „żywszy".
  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.7] });
  const textOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1] });

  const amountLabel = useMemo(() => {
    const n = Number(amount || 0);
    if (!Number.isFinite(n) || n <= 0) return null;
    return `${n.toLocaleString('pl-PL')} PLN`;
  }, [amount]);

  return (
    <View style={styles.wrap} accessibilityRole="alert" accessibilityLabel="Czekamy na ostateczną decyzję właściciela">
      {/* Halo — szeroki rozproszony blask „pod" pigułką. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.halo,
          {
            opacity: glowOpacity,
            transform: [{ scale: ringScale }],
          },
        ]}
      />

      {/* Korpus „neonu" — ramka pulsuje skalą i jasnością. */}
      <Animated.View
        style={[
          styles.body,
          {
            opacity: ringOpacity,
            transform: [{ scale: ringScale }],
          },
        ]}
      >
        <View style={styles.heartDotRow}>
          <View style={styles.heartDot} />
          <Animated.Text style={[styles.eyebrow, { opacity: textOpacity }]}>
            CZEKAMY NA DECYZJĘ
          </Animated.Text>
          <View style={styles.heartDot} />
        </View>
        <Animated.Text style={[styles.headline, { opacity: textOpacity }]} numberOfLines={2}>
          {headline || 'Twoja akceptacja dotarła do właściciela'}
        </Animated.Text>
        {amountLabel ? (
          <Animated.Text style={[styles.amount, { opacity: textOpacity }]} numberOfLines={1}>
            {amountLabel}
          </Animated.Text>
        ) : null}
        <Animated.Text style={[styles.sub, { opacity: textOpacity }]} numberOfLines={3}>
          {sublabel || 'Ostateczne potwierdzenie sprzedaży należy teraz do właściciela. Dostaniesz powiadomienie, gdy podejmie decyzję.'}
        </Animated.Text>
      </Animated.View>
    </View>
  );
}

const NEON = '#10b981';

const styles = StyleSheet.create({
  wrap: {
    marginTop: 4,
    marginBottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  halo: {
    position: 'absolute',
    width: '92%',
    height: '92%',
    borderRadius: 24,
    backgroundColor: NEON,
    shadowColor: NEON,
    shadowOpacity: 1,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
  },
  body: {
    alignSelf: 'stretch',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 20,
    borderWidth: 1.4,
    borderColor: NEON,
    backgroundColor: 'rgba(16,185,129,0.08)',
    alignItems: 'center',
    shadowColor: NEON,
    shadowOpacity: 0.65,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  heartDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  heartDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: NEON,
    shadowColor: NEON,
    shadowOpacity: 1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  eyebrow: {
    color: NEON,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2.6,
  },
  headline: {
    color: '#E7FFEF',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.2,
    lineHeight: 19,
  },
  amount: {
    marginTop: 8,
    color: NEON,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
  },
  sub: {
    marginTop: 8,
    color: '#A8DCC0',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 6,
  },
});

/**
 * ====================================================================
 *  EstateOS™ — Zaślepka „Oferta zakończona / nieaktualna" (dark glass)
 * ====================================================================
 *
 *  Pełnoekranowy overlay nakładany na widok oferty, gdy oferta nie jest
 *  już aktywna (sprzedana, wycofana, wygasła, odrzucona, anulowana).
 *  Cel:
 *    1. PEŁNA blokada interakcji — nikt nie może wysłać propozycji ceny,
 *       umówić prezentacji, ani „dotknąć" CTA „Skontaktuj się".
 *    2. UCZCIWA komunikacja — duży, godny napis z powodem, bez krzyku,
 *       bez clickbaitu, w spójnej estetyce Apple.
 *    3. ŁAGODNE WYJŚCIE — przycisk „Wróć do Radaru" + „Przeglądaj
 *       podobne oferty" (jeśli rodzic poda callback).
 *
 *  Estetyka:
 *    • `BlurView` jako baza (efekt frosted glass) + dodatkowa półprzezroczysta
 *      czarna warstwa, żeby tło ekranu nie świeciło przez napisy.
 *    • Subtelny pulsujący punkt obok eyebrow — sygnalizuje, że to STAN
 *      systemu (nie błąd, nie awaria) — coś jak „indicator" w Apple Music.
 *    • Linia haptyczna pod nagłówkiem (cienki, świecący separator) —
 *      delikatny akcent kolorystyczny zgodny z powodem zamknięcia
 *      (czerwony=odrzucona, bursztyn=expired, neutralny=archived/sold).
 *
 *  Komponent jest „dumb" — całą logikę „czy oferta jest zamknięta"
 *  liczymy w `src/utils/offerLifecycle.ts`. Tutaj tylko renderujemy.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Lock, Compass, ChevronLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import type { OfferLifecycleReason } from '../utils/offerLifecycle';

type Props = {
  visible: boolean;
  reason: OfferLifecycleReason;
  headline: string;
  subline: string;
  isDark?: boolean;
  /**
   * Czy zalogowany użytkownik jest właścicielem zamkniętej oferty.
   * Dla właściciela tonujemy komunikat („Twoja oferta jest …") i pokazujemy
   * przycisk „Wróć do panelu", bo on AKTUALNIE patrzy na własną ofertę.
   * Dla obcego widza pokazujemy „Wróć do Radaru" i „Podobne oferty".
   */
  isOwner?: boolean;
  onGoBack?: () => void;
  onBrowseSimilar?: () => void;
};

const ACCENT_BY_REASON: Record<OfferLifecycleReason, string> = {
  SOLD: '#10b981',
  ARCHIVED: '#9ca3af',
  EXPIRED: '#f59e0b',
  REJECTED: '#ef4444',
  INACTIVE: '#9ca3af',
  UNKNOWN_CLOSED: '#9ca3af',
};

export default function ClosedOfferOverlay({
  visible,
  reason,
  headline,
  subline,
  isDark = true,
  isOwner = false,
  onGoBack,
  onBrowseSimilar,
}: Props) {
  const fade = useRef(new Animated.Value(0)).current;
  const dotPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      fade.setValue(0);
      return;
    }
    Animated.timing(fade, {
      toValue: 1,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotPulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(dotPulse, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, fade, dotPulse]);

  if (!visible) return null;

  const accent = ACCENT_BY_REASON[reason] || '#9ca3af';
  const dotOpacity = dotPulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  const dotScale = dotPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] });

  return (
    <Animated.View pointerEvents="auto" style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]}>
      {/* Warstwa 1 — BlurView w `dark` tincie, intensywny żeby tło ekranu
          straciło ostrość i nie odciągało wzroku od komunikatu. */}
      <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />

      {/* Warstwa 2 — gradient czarno-przezroczysty, lekko mocniejszy
          w środku ekranu, żeby tekst miał stabilny kontrast nawet na
          jasnych zdjęciach hero. */}
      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0.78)', 'rgba(0,0,0,0.92)']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Warstwa 3 — treść. Trzymamy ją w `safe-padding`, centralnie. */}
      <View style={styles.contentWrap}>
        <View style={[styles.iconWrap, { borderColor: `${accent}55`, backgroundColor: `${accent}1A` }]}>
          <Lock color={accent} size={28} strokeWidth={2} />
        </View>

        <View style={styles.eyebrowRow}>
          <Animated.View
            style={[
              styles.eyebrowDot,
              { backgroundColor: accent, shadowColor: accent, opacity: dotOpacity, transform: [{ scale: dotScale }] },
            ]}
          />
          <Text style={[styles.eyebrowText, { color: accent }]}>STAN OFERTY</Text>
        </View>

        <Text style={styles.headline} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85}>
          {isOwner ? formatOwnerHeadline(headline) : headline}
        </Text>

        <View style={[styles.divider, { backgroundColor: accent, shadowColor: accent }]} />

        <Text style={styles.subline}>{subline}</Text>

        <View style={styles.actionsRow}>
          {onGoBack ? (
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                onGoBack();
              }}
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && { opacity: 0.85 },
                isDark && { backgroundColor: '#ffffff' },
              ]}
            >
              <ChevronLeft size={18} color={isDark ? '#000000' : '#ffffff'} />
              <Text style={[styles.primaryBtnText, { color: isDark ? '#000000' : '#ffffff' }]} numberOfLines={1}>
                {isOwner ? 'Wróć do panelu' : 'Wróć'}
              </Text>
            </Pressable>
          ) : null}
          {onBrowseSimilar ? (
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                onBrowseSimilar();
              }}
              style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.78 }]}
            >
              <Compass size={16} color="#ffffff" />
              <Text style={styles.secondaryBtnText} numberOfLines={1}>
                Podobne oferty
              </Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.fineprint}>EstateOS™ chroni Twoje decyzje. Tej oferty nie da się dzisiaj wziąć.</Text>
      </View>
    </Animated.View>
  );
}

function formatOwnerHeadline(headline: string): string {
  // Drobny lift tonu dla właściciela: zamiast bezosobowego komunikatu
  // używamy „Twoja oferta jest …". Jest mniej dystansująco.
  return headline.replace(/^Oferta /, 'Twoja oferta jest ').replace(/^Nieruchomość /, 'Twoja nieruchomość ');
}

const styles = StyleSheet.create({
  /** Najwyższe `zIndex` żeby przykryć WSZYSTKO — także dolny pasek CTA,
   *  modal map itp. */
  root: {
    zIndex: 9999,
    elevation: 30,
  },
  contentWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  eyebrowDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    shadowOpacity: 1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  eyebrowText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2.8,
    textTransform: 'uppercase',
  },
  headline: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
    textAlign: 'center',
    lineHeight: 32,
  },
  divider: {
    width: 56,
    height: 2,
    borderRadius: 2,
    marginTop: 16,
    marginBottom: 16,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  subline: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 28,
    width: '100%',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    minWidth: 140,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  secondaryBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  fineprint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginTop: 28,
    textAlign: 'center',
  },
});

import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useEcosystemStore } from '../store/useEcosystemStore';
import { useCarScreenTheme, type CarScreenColors, carCardElevation } from '../theme/carScreenTheme';

export default function CarsHubScreen() {
  const setActiveVertical = useEcosystemStore((s) => s.setActiveVertical);
  const { colors, isDark } = useCarScreenTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>EstateOS™Car</Text>
      <Text style={styles.title}>Moduł samochodowy w ekosystemie EstateOS</Text>
      <Text style={styles.lead}>
        Jedno konto, jedna sesja i płynne przełączanie pomiędzy EstateOS™Home oraz EstateOS™Car.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Roadmapa kolejnego etapu</Text>
        <Text style={styles.cardLine}>- Katalog aut z filtrami: marka, model, przebieg, paliwo</Text>
        <Text style={styles.cardLine}>- Szczegóły oferty auta i formularz kontaktu</Text>
        <Text style={styles.cardLine}>- Dodawanie i edycja ogłoszeń samochodowych</Text>
      </View>

      <Pressable
        onPress={() => setActiveVertical('home')}
        style={({ pressed }) => [styles.switchBtn, pressed && styles.switchBtnPressed]}
      >
        <Text style={styles.switchBtnLabel}>Przełącz na EstateOS™Home</Text>
      </Pressable>
    </ScrollView>
  );
}

function createStyles(colors: CarScreenColors, isDark: boolean) {
  return StyleSheet.create({
    container: {
      minHeight: '100%',
      paddingHorizontal: 20,
      paddingTop: 110,
      paddingBottom: 60,
      backgroundColor: colors.bg,
      gap: 14,
    },
    eyebrow: {
      color: colors.accentSoft,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 2.2,
      textTransform: 'uppercase',
    },
    title: {
      color: colors.text,
      fontSize: 30,
      fontWeight: '700',
      letterSpacing: -0.6,
      lineHeight: 36,
    },
    lead: {
      color: colors.muted,
      fontSize: 15,
      lineHeight: 23,
    },
    card: {
      marginTop: 6,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      padding: 14,
      gap: 8,
      ...carCardElevation(isDark, 'sm'),
    },
    cardTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    cardLine: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 20,
    },
    switchBtn: {
      marginTop: 8,
      alignSelf: 'flex-start',
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.homeSwitchBorder,
      backgroundColor: colors.homeSwitchBg,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    switchBtnPressed: {
      opacity: 0.85,
    },
    switchBtnLabel: {
      color: colors.homeSwitchText,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 1.5,
      textTransform: 'uppercase',
    },
  });
}

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { fetchCarsByUserId, type CarListing } from '../../services/carsApi';
import { useMoneyContext } from '../../money/useMoneyContext';
import { useCarScreenTheme, type CarScreenColors, carCardElevation } from '../../theme/carScreenTheme';

type SellerCarsSectionProps = {
  userId: number;
  excludeCarId: number;
};

export default function SellerCarsSection({ userId, excludeCarId }: SellerCarsSectionProps) {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useCarScreenTheme();
  const { formatOffer } = useMoneyContext();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const [cars, setCars] = useState<CarListing[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchCarsByUserId(userId)
      .then((rows) => {
        if (!cancelled) setCars(rows.filter((car) => car.id !== excludeCarId).slice(0, 8));
      })
      .catch(() => {
        if (!cancelled) setCars([]);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, excludeCarId]);

  if (cars.length === 0) return null;

  return (
    <View style={styles.root}>
      <Text style={styles.eyebrow}>Sprzedający</Text>
      <Text style={styles.title}>Inne ogłoszenia tego sprzedającego</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {cars.map((car) => (
          <Pressable
            key={car.id}
            style={styles.card}
            onPress={() => navigation.push('CarDetail', { carId: car.id, car })}
          >
            <Image source={{ uri: car.imageUrl }} style={styles.image} contentFit="cover" />
            <Text style={styles.cardTitle} numberOfLines={2}>
              {car.title}
            </Text>
            <Text style={styles.cardMeta}>
              {car.year} · {car.city}
            </Text>
            <Text style={styles.cardPrice}>{formatOffer(car).primary}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: CarScreenColors, isDark: boolean) {
  return StyleSheet.create({
    root: { marginTop: 8, gap: 8 },
    eyebrow: {
      color: colors.accentSoft,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1.6,
      textTransform: 'uppercase',
    },
    title: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 4 },
    row: { gap: 12, paddingVertical: 4 },
    card: {
      width: 168,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      overflow: 'hidden',
      ...carCardElevation(isDark, 'sm'),
    },
    image: { width: '100%', height: 110, backgroundColor: colors.surfaceMuted },
    cardTitle: { color: colors.text, fontSize: 13, fontWeight: '700', paddingHorizontal: 10, paddingTop: 8 },
    cardMeta: { color: colors.muted, fontSize: 11, paddingHorizontal: 10, marginTop: 2 },
    cardPrice: {
      color: colors.accentSoft,
      fontSize: 13,
      fontWeight: '800',
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
  });
}

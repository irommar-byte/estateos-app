import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Heart } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  isCarFavoriteId,
  loadCarFavoriteIds,
  toggleCarFavoriteId,
} from '../../utils/carFavoritesStorage';
import { useCarScreenColors } from '../../theme/carScreenTheme';

type CarFavoriteButtonProps = {
  carId: number;
  size?: number;
  style?: object;
  onAuthRequired?: () => void;
  isLoggedIn?: boolean;
  onToggle?: (carId: number, added: boolean) => void;
};

export default function CarFavoriteButton({
  carId,
  size = 22,
  style,
  onAuthRequired,
  isLoggedIn = true,
  onToggle,
}: CarFavoriteButtonProps) {
  const colors = useCarScreenColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        btn: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.favButtonBg,
          borderWidth: 1,
          borderColor: colors.favButtonBorder,
        },
      }),
    [colors],
  );
  const [favorites, setFavorites] = useState<number[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const heartScale = useSharedValue(1);
  const isFavorite = isCarFavoriteId(carId, favorites);

  useEffect(() => {
    let cancelled = false;
    void loadCarFavoriteIds().then((ids) => {
      if (!cancelled) {
        setFavorites(ids);
        setHydrated(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [carId]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  const handlePress = async () => {
    if (!isLoggedIn) {
      onAuthRequired?.();
      return;
    }
    heartScale.value = withSpring(1.45, { damping: 2, stiffness: 80 }, () => {
      heartScale.value = withSpring(1);
    });
    const { ids, added } = await toggleCarFavoriteId(carId, favorites);
    setFavorites(ids);
    onToggle?.(carId, added);
    if (added) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  if (!hydrated) return null;

  return (
    <Pressable onPress={() => void handlePress()} hitSlop={10} style={[styles.btn, style]}>
      <Animated.View style={animatedStyle}>
        <Heart
          size={size}
          color={isFavorite ? '#EF4444' : colors.muted}
          fill={isFavorite ? '#EF4444' : 'transparent'}
          strokeWidth={2}
        />
      </Animated.View>
    </Pressable>
  );
}

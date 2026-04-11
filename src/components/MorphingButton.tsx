import React, { useRef } from 'react';
import { Animated, Pressable, Text, StyleSheet, Dimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function MorphingButton({ onPress, label, onValidate }: { onPress: () => void, label: string, onValidate?: () => boolean }) {
  const anim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    React.useCallback(() => {
      anim.setValue(0);
      Animated.spring(anim, { toValue: 1, friction: 8, tension: 50, useNativeDriver: false }).start();
      return () => { anim.setValue(0); };
    }, [anim])
  );

  const handlePress = () => {
    if (onValidate && !onValidate()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: false }).start(() => { onPress(); });
  };

  const buttonWidth = anim.interpolate({ inputRange: [0, 1], outputRange: [65, SCREEN_WIDTH - 40] });
  const textOpacity = anim.interpolate({ inputRange: [0.5, 1], outputRange: [0, 1] });
  const plusOpacity = anim.interpolate({ inputRange: [0, 0.5], outputRange: [1, 0] });

  return (
    <View style={{ alignItems: 'center', marginTop: 40 }}>
      <Pressable onPress={handlePress}>
        <Animated.View style={[styles.btn, { width: buttonWidth }]}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.center, { opacity: textOpacity, flexDirection: 'row' }]}>
            <Text style={styles.text}>{label}</Text>
            <Ionicons name="arrow-forward" size={24} color="#ffffff" />
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, styles.center, { opacity: plusOpacity }]}>
            <Ionicons name="add" size={32} color="#ffffff" />
          </Animated.View>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { height: 65, borderRadius: 32.5, backgroundColor: '#10b981', overflow: 'hidden', shadowColor: '#10b981', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 8 },
  center: { justifyContent: 'center', alignItems: 'center' },
  text: { color: '#ffffff', fontSize: 18, fontWeight: '700', marginRight: 10 }
});

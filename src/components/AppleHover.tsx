import React, { useRef } from 'react';
import { Animated, Pressable, Platform, ViewStyle, StyleProp } from 'react-native';

interface Props {
  children: React.ReactNode;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
}

export default function AppleHover({ children, onPress, style, scaleTo = 1.02 }: Props) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true }).start();
  const handlePressOut = () => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
  
  const handleHoverIn = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: scaleTo, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0.7, duration: 150, useNativeDriver: true })
    ]).start();
  };
  
  const handleHoverOut = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 150, useNativeDriver: true })
    ]).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      {...(Platform.OS === 'web' ? { onHoverIn: handleHoverIn, onHoverOut: handleHoverOut } : {})}
    >
      <Animated.View style={[style, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

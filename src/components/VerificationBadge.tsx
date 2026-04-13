import React, { useRef, useEffect } from 'react';
import { View, Text, Pressable, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const VerificationBadge = ({ isVerified, onPress, isDark }: any) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isVerified) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true })
        ])
      ).start();
    }
  }, [isVerified]);

  if (isVerified) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          backgroundColor: 'rgba(16, 185, 129, 0.1)', 
          paddingHorizontal: 12, 
          paddingVertical: 6, 
          borderRadius: 12, 
          borderWidth: 1, 
          borderColor: 'rgba(16, 185, 129, 0.3)' 
        }}>
          <Ionicons name="shield-checkmark" size={16} color="#10b981" style={{ marginRight: 6 }} />
          <Text style={{ color: '#10b981', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 }}>PROFIL ZWERYFIKOWANY</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 12 }}>
      <Animated.View style={{ 
        transform: [{ scale: pulseAnim }], 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: 'rgba(239, 68, 68, 0.1)', 
        paddingHorizontal: 10, 
        paddingVertical: 5, 
        borderRadius: 10, 
        borderWidth: 1, 
        borderColor: 'rgba(239, 68, 68, 0.3)'
      }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444', marginRight: 6 }} />
        <Text style={{ color: '#ef4444', fontSize: 11, fontWeight: '800' }}>NIEZWERYFIKOWANY</Text>
      </Animated.View>
      <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14 }]}>
        <Text style={{ color: '#10b981', fontSize: 13, fontWeight: '800' }}>Zweryfikuj SMS</Text>
      </Pressable>
    </View>
  );
};

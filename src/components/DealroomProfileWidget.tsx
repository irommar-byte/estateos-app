import React from 'react';
import { StyleSheet, View, Text, Pressable } from 'react-native';
import { ShieldCheck, ChevronRight } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeIn } from 'react-native-reanimated';

export default function DealroomProfileWidget() {
  const navigation = useNavigation<any>();

  return (
    <Animated.View entering={FadeIn.delay(200)}>
      <Pressable 
        style={({ pressed }) => [
          styles.container,
          pressed && styles.pressed
        ]}
        onPress={() => navigation.navigate('DealroomList')}
      >
        <View style={styles.leftContent}>
          <View style={styles.iconContainer}>
            <ShieldCheck size={22} color="#10b981" strokeWidth={2.5} />
          </View>
          <View>
            <Text style={styles.title}>Dealroom</Text>
            <Text style={styles.subtitle}>Centrum bezpiecznych transakcji</Text>
          </View>
        </View>
        
        <View style={styles.rightContent}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Aktywne</Text>
          </View>
          <ChevronRight size={20} color="#444444" />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111111', 
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 16,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  pressed: {
    backgroundColor: '#1A1A1A',
    transform: [{ scale: 0.98 }],
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.1)', 
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  title: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: '#86868b',
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
  },
  rightContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 12,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Animated, Dimensions, Modal } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

export default function FloorPlanViewer({ imageUrl, theme }: { imageUrl: string, theme?: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const animValue = useRef(new Animated.Value(0)).current;

  const isDark = theme?.glass === 'dark' || theme?.dark;

  const openModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsOpen(true);
    Animated.spring(animValue, {
      toValue: 1,
      friction: 6,
      tension: 40,
      useNativeDriver: true
    }).start();
  };

  const closeModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(animValue, {
      toValue: 0,
      friction: 8,
      tension: 50,
      useNativeDriver: true
    }).start(() => setIsOpen(false));
  };

  if (!imageUrl) return null;

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, { color: isDark ? '#8E8E93' : '#8E8E93' }]}>Rzut / Plan Nieruchomości</Text>
      
      {/* Intrygujący, rozmyty podgląd na karcie oferty */}
      <Pressable onPress={openModal} style={[styles.thumbnailWrapper, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
        <Image source={{ uri: imageUrl }} style={styles.thumbnail} blurRadius={4} />
        <View style={styles.thumbnailOverlay}>
          <View style={styles.iconGlass}>
            <Ionicons name="expand-outline" size={28} color="#FFF" />
          </View>
          <Text style={styles.thumbnailText}>Powiększ rzut</Text>
        </View>
      </Pressable>

      {/* Modal z efektem wyskakiwania rodem z macOS */}
      {isOpen && (
        <Modal transparent={true} visible={true} animationType="none" onRequestClose={closeModal}>
          <BlurView intensity={90} tint={isDark ? "dark" : "light"} style={StyleSheet.absoluteFill}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeModal} />
            
            <Animated.View style={[
              styles.modalContent,
              {
                backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
                borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                opacity: animValue,
                transform: [
                  { scale: animValue.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
                  { translateY: animValue.interpolate({ inputRange: [0, 1], outputRange: [100, 0] }) }
                ]
              }
            ]}>
              
              {/* Pasek narzędziowy w stylu macOS */}
              <View style={[styles.macOsHeader, { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA', borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }]}>
                <View style={styles.macOsDots}>
                  {/* Czerwona kropka zamyka modal */}
                  <Pressable onPress={closeModal} style={[styles.macDot, { backgroundColor: '#FF5F56' }]} hitSlop={10} />
                  <View style={[styles.macDot, { backgroundColor: '#FFBD2E' }]} />
                  <View style={[styles.macDot, { backgroundColor: '#27C93F' }]} />
                </View>
                <Text style={[styles.macOsTitle, { color: isDark ? '#8E8E93' : '#333' }]}>Plan_Wnetrza.pdf</Text>
              </View>
              
              {/* Obszar wyświetlania rzutu */}
              <View style={[styles.imageContainer, { backgroundColor: isDark ? '#000' : '#FFF' }]}>
                <Image source={{ uri: imageUrl }} style={styles.fullImage} resizeMode="contain" />
              </View>
              
            </Animated.View>
          </BlurView>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '800', marginBottom: 15, textTransform: 'uppercase', letterSpacing: 1.2, marginLeft: 4 },
  
  thumbnailWrapper: { height: 180, borderRadius: 24, overflow: 'hidden', borderWidth: 1 },
  thumbnail: { width: '100%', height: '100%' },
  thumbnailOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'center', alignItems: 'center' },
  iconGlass: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  thumbnailText: { color: '#FFF', fontSize: 14, fontWeight: '800', letterSpacing: 0.5, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  
  modalContent: { flex: 1, marginHorizontal: 16, marginTop: 80, marginBottom: 80, borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 25 }, shadowOpacity: 0.5, shadowRadius: 35, elevation: 20, borderWidth: 1 },
  macOsHeader: { height: 44, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: 1 },
  macOsDots: { flexDirection: 'row', gap: 8, position: 'absolute', left: 16 },
  macDot: { width: 12, height: 12, borderRadius: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1 },
  macOsTitle: { flex: 1, textAlign: 'center', fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  imageContainer: { flex: 1, padding: 5 },
  fullImage: { width: '100%', height: '100%', borderRadius: 12 }
});

import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Animated, Modal } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useI18n } from '../i18n';

export default function FloorPlanViewer({
  imageUrl,
  theme,
}: {
  imageUrl?: string | null;
  theme?: { glass?: string; dark?: boolean };
}) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const animValue = useRef(new Animated.Value(0)).current;

  const isDark = theme?.glass === 'dark' || theme?.dark;
  const hasPlan = Boolean(imageUrl?.trim());

  const openModal = () => {
    if (!hasPlan) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsOpen(true);
    Animated.spring(animValue, {
      toValue: 1,
      friction: 6,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const closeModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.spring(animValue, {
      toValue: 0,
      friction: 8,
      tension: 50,
      useNativeDriver: true,
    }).start(() => setIsOpen(false));
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, { color: '#8E8E93' }]}>
        {t('offer.detail.floorPlan.sectionTitle')}
      </Text>

      {hasPlan ? (
        <Pressable
          onPress={openModal}
          style={[
            styles.thumbnailWrapper,
            { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' },
          ]}
        >
          <Image source={{ uri: imageUrl! }} style={styles.thumbnail} blurRadius={4} />
          <View style={styles.thumbnailOverlay}>
            <View style={styles.iconGlass}>
              <Ionicons name="expand-outline" size={28} color="#FFF" />
            </View>
            <Text style={styles.thumbnailText}>{t('offer.detail.floorPlan.enlarge')}</Text>
          </View>
        </Pressable>
      ) : (
        <View
          style={[
            styles.emptyCard,
            {
              backgroundColor: isDark ? 'rgba(28,28,30,0.72)' : '#F5F5F7',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            },
          ]}
        >
          <View
            style={[
              styles.emptyIconWrap,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              },
            ]}
          >
            <Ionicons name="map-outline" size={22} color={isDark ? '#9ca3af' : '#86868b'} />
          </View>
          <Text style={[styles.emptyTitle, { color: isDark ? '#e5e7eb' : '#1d1d1f' }]}>
            {t('offer.detail.floorPlan.emptyTitle')}
          </Text>
          <Text style={[styles.emptySubtitle, { color: isDark ? '#9ca3af' : '#86868b' }]}>
            {t('offer.detail.floorPlan.emptySubtitle')}
          </Text>
        </View>
      )}

      {hasPlan && isOpen && (
        <Modal transparent visible animationType="none" onRequestClose={closeModal}>
          <BlurView intensity={90} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeModal} />

            <Animated.View
              style={[
                styles.modalContent,
                {
                  backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
                  borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                  opacity: animValue,
                  transform: [
                    { scale: animValue.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
                    { translateY: animValue.interpolate({ inputRange: [0, 1], outputRange: [100, 0] }) },
                  ],
                },
              ]}
            >
              <View
                style={[
                  styles.macOsHeader,
                  {
                    backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA',
                    borderBottomColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  },
                ]}
              >
                <View style={styles.macOsDots}>
                  <Pressable
                    onPress={closeModal}
                    style={[styles.macDot, { backgroundColor: '#FF5F56' }]}
                    hitSlop={10}
                  />
                  <View style={[styles.macDot, { backgroundColor: '#FFBD2E' }]} />
                  <View style={[styles.macDot, { backgroundColor: '#27C93F' }]} />
                </View>
                <Text style={[styles.macOsTitle, { color: isDark ? '#8E8E93' : '#333' }]}>
                  Plan_Wnetrza.pdf
                </Text>
              </View>

              <View style={[styles.imageContainer, { backgroundColor: isDark ? '#000' : '#FFF' }]}>
                <Image source={{ uri: imageUrl! }} style={styles.fullImage} resizeMode="contain" />
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
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 15,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginLeft: 4,
  },

  thumbnailWrapper: { height: 180, borderRadius: 24, overflow: 'hidden', borderWidth: 1 },
  thumbnail: { width: '100%', height: '100%' },
  thumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconGlass: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  thumbnailText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },

  emptyCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  emptyIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 280,
  },

  modalContent: {
    flex: 1,
    marginHorizontal: 16,
    marginTop: 80,
    marginBottom: 80,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 25 },
    shadowOpacity: 0.5,
    shadowRadius: 35,
    elevation: 20,
    borderWidth: 1,
  },
  macOsHeader: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  macOsDots: { flexDirection: 'row', gap: 8, position: 'absolute', left: 16 },
  macDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  macOsTitle: { flex: 1, textAlign: 'center', fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  imageContainer: { flex: 1, padding: 5 },
  fullImage: { width: '100%', height: '100%', borderRadius: 12 },
});

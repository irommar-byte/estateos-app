import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  lat: number;
  lng: number;
  title?: string;
  onClose: () => void;
  isDark?: boolean;
};

function streetViewUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/embed?pb=!4v0!6m8!1m7!1s!2m2!1d${lat}!2d${lng}!3f0!4f0!5f0.75`;
}

function streetViewFallbackUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
}

export default function StreetViewPreviewModal({ visible, lat, lng, title, onClose, isDark }: Props) {
  const insets = useSafeAreaInsets();
  const uri = streetViewFallbackUrl(lat, lng);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: isDark ? '#000' : '#F2F2F7', paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: isDark ? '#fff' : '#111' }]}>{title || 'Street View'}</Text>
            <Text style={{ color: isDark ? '#8E8E93' : '#6C6C70', fontSize: 12, marginTop: 2 }}>
              Podgląd otoczenia nieruchomości
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
            <Ionicons name="close" size={26} color={isDark ? '#fff' : '#111'} />
          </Pressable>
        </View>
        <WebView
          source={{ uri }}
          style={styles.web}
          startInLoadingState
          allowsInlineMediaPlayback
          javaScriptEnabled
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  title: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  web: { flex: 1, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(120,120,128,0.35)' },
});

import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LUX_SERIF, type LuxPalette } from './luxTheme';

/** Arkusz od dołu (iOS page sheet) w stylu panelu. */
export default function LuxSheet({
  open,
  onClose,
  kicker,
  title,
  palette,
  children,
  scroll = true,
  full = false,
}: {
  open: boolean;
  onClose: () => void;
  kicker?: string;
  title: string;
  palette: LuxPalette;
  children: React.ReactNode;
  scroll?: boolean;
  full?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={open}
      onRequestClose={onClose}
      animationType="slide"
      presentationStyle={full ? 'fullScreen' : 'pageSheet'}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: palette.bg, paddingTop: full ? insets.top : 0 }}
      >
        <View style={[styles.head, { borderBottomColor: palette.border }]}>
          <View style={{ flex: 1 }}>
            {kicker ? <Text style={[styles.kicker, { color: palette.accent }]}>{kicker.toUpperCase()}</Text> : null}
            <Text style={[styles.title, { color: palette.ink }]} numberOfLines={2}>
              {title}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={[styles.close, { backgroundColor: palette.cardAlt }]}>
            <Ionicons name="close" size={20} color={palette.ink} />
          </Pressable>
        </View>
        {scroll ? (
          <ScrollView
            contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 32 }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          <View style={{ flex: 1 }}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  title: { fontFamily: LUX_SERIF, fontSize: 24, marginTop: 3 },
  close: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});

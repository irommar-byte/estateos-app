import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export type ClientOutboundPreview = {
  kind?: string;
  to: string | null;
  subject: string;
  bodyPreview: string;
  smsBody?: string | null;
  channels?: string[];
};

type Props = {
  visible: boolean;
  preview: ClientOutboundPreview | null;
  busy?: boolean;
  colors: {
    card: string;
    text: string;
    secondary: string;
    border: string;
    accent: string;
    bg: string;
  };
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ClientOutboundPreviewSheet({
  visible,
  preview,
  busy,
  colors,
  onCancel,
  onConfirm,
}: Props) {
  if (!preview) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={busy ? undefined : onCancel} />
        <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 }}>
            PODGLĄD PRZED WYSŁANIEM
          </Text>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900', marginTop: 6 }}>
            Sprawdź treść do klienta
          </Text>
          <Text style={{ color: colors.secondary, fontSize: 13, marginTop: 4, lineHeight: 18 }}>
            Nic nie poszło jeszcze. Po zatwierdzeniu wyślemy dokładnie to, co widać poniżej.
          </Text>

          <ScrollView style={{ marginTop: 16, maxHeight: 420 }} contentContainerStyle={{ gap: 12, paddingBottom: 8 }}>
            <View style={[styles.block, { borderColor: colors.border, backgroundColor: colors.bg }]}>
              <Text style={styles.label}>DO</Text>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{preview.to || 'Brak e-maila — tylko panel / SMS'}</Text>
            </View>
            <View style={[styles.block, { borderColor: colors.border, backgroundColor: colors.bg }]}>
              <Text style={styles.label}>TEMAT</Text>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{preview.subject}</Text>
            </View>
            <View style={[styles.block, { borderColor: colors.border, backgroundColor: colors.bg }]}>
              <Text style={styles.label}>TREŚĆ MAILA</Text>
              <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>{preview.bodyPreview}</Text>
            </View>
            {preview.smsBody ? (
              <View style={[styles.block, { borderColor: colors.border, backgroundColor: colors.bg }]}>
                <Text style={styles.label}>SMS</Text>
                <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>{preview.smsBody}</Text>
              </View>
            ) : null}
            {preview.channels?.length ? (
              <Text style={{ color: colors.secondary, fontSize: 12, fontWeight: '700' }}>
                Kanały: {preview.channels.join(' · ')}
              </Text>
            ) : null}
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <Pressable
              onPress={onCancel}
              disabled={busy}
              style={[styles.btn, { borderColor: colors.border, flex: 1 }]}
            >
              <Text style={{ color: colors.text, fontWeight: '800', textAlign: 'center' }}>Anuluj</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={busy}
              style={[styles.btn, { backgroundColor: '#34C759', borderColor: '#34C759', flex: 1, opacity: busy ? 0.6 : 1 }]}
            >
              <Text style={{ color: '#000', fontWeight: '900', textAlign: 'center' }}>
                {busy ? 'Wysyłam…' : 'Wyślij'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
  },
  block: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  label: {
    color: '#8E8E93',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  btn: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
  },
});

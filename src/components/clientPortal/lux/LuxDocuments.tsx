import React, { useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { LuxCard, LuxKicker, LuxTitle } from './LuxUI';
import { uploadPortalDocument } from './luxApi';
import type { LuxPalette } from './luxTheme';
import type { LuxDocument } from './types';

const STATUS: Record<LuxDocument['status'], { label: string; icon: keyof typeof Ionicons.glyphMap; tone: string }> = {
  missing: { label: 'Brakuje', icon: 'ellipse-outline', tone: '#8C877D' },
  uploaded: { label: 'Wysłane — agent sprawdza', icon: 'time-outline', tone: '#C98A1B' },
  accepted: { label: 'Gotowe', icon: 'checkmark-circle', tone: '#2F9E6A' },
  rejected: { label: 'Do poprawy', icon: 'alert-circle', tone: '#C2412D' },
};

type Picked = { uri: string; name: string; type: string };

async function pickFile(source: 'camera' | 'library' | 'file'): Promise<Picked | null> {
  if (source === 'file') {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return null;
    const a = res.assets[0];
    return { uri: a.uri, name: a.name || 'dokument.pdf', type: a.mimeType || 'application/pdf' };
  }
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Aparat', 'Włącz dostęp do aparatu w ustawieniach, żeby zrobić zdjęcie dokumentu.');
      return null;
    }
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7 };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  const ext = (a.mimeType || 'image/jpeg').includes('png') ? 'png' : 'jpg';
  return { uri: a.uri, name: a.fileName || `dokument-${Date.now()}.${ext}`, type: a.mimeType || 'image/jpeg' };
}

function chooseSource(): Promise<'camera' | 'library' | 'file' | null> {
  return new Promise((resolve) => {
    const options = ['Zrób zdjęcie', 'Wybierz zdjęcie', 'Wybierz plik (PDF)', 'Anuluj'];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: 3 }, (i) =>
        resolve(i === 0 ? 'camera' : i === 1 ? 'library' : i === 2 ? 'file' : null),
      );
    } else {
      Alert.alert('Dodaj dokument', undefined, [
        { text: options[0], onPress: () => resolve('camera') },
        { text: options[1], onPress: () => resolve('library') },
        { text: options[2], onPress: () => resolve('file') },
        { text: options[3], style: 'cancel', onPress: () => resolve(null) },
      ]);
    }
  });
}

/** Lista dokumentów „co jeszcze brakuje” — wrzucanie z telefonu (aparat, galeria, plik). */
export default function LuxDocuments({
  token,
  documents,
  summary,
  palette,
  agentFirst,
  canUpload,
  onChanged,
}: {
  token: string;
  documents: LuxDocument[];
  summary?: { required: number; done: number; missing: number; toReview: number };
  palette: LuxPalette;
  agentFirst: string;
  canUpload: boolean;
  onChanged: () => void;
}) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  if (!documents.length) return null;

  const upload = async (doc: LuxDocument) => {
    const source = await chooseSource();
    if (!source) return;
    const file = await pickFile(source);
    if (!file) return;
    setBusyKey(doc.key);
    try {
      await uploadPortalDocument(token, doc.key, file);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onChanged();
    } catch (e) {
      Alert.alert('Dokument', e instanceof Error ? e.message : 'Nie udało się wysłać pliku.');
    } finally {
      setBusyKey(null);
    }
  };

  const required = summary?.required ?? documents.filter((d) => d.required).length;
  const done = summary?.done ?? 0;

  return (
    <LuxCard palette={palette}>
      <LuxKicker palette={palette}>Dokumenty</LuxKicker>
      <LuxTitle palette={palette}>{summary?.missing ? `Brakuje ${summary.missing} z ${required}` : 'Komplet dokumentów'}</LuxTitle>
      <View style={[styles.progress, { backgroundColor: palette.cardAlt }]}>
        <View style={{ width: `${required ? Math.round((done / required) * 100) : 100}%`, height: '100%', backgroundColor: palette.good, borderRadius: 3 }} />
      </View>
      <Text style={{ fontSize: 13, color: palette.muted, marginTop: 8, lineHeight: 18 }}>
        Wystarczy zdjęcie telefonem. {agentFirst} sprawdzi każdy dokument i da znać, jeśli coś trzeba poprawić.
      </Text>
      {documents.map((doc) => {
        const st = STATUS[doc.status];
        return (
          <View key={doc.key} style={[styles.row, { borderTopColor: palette.border }]}>
            <Ionicons name={st.icon} size={22} color={st.tone} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: palette.ink }}>
                {doc.label}
                {!doc.required ? <Text style={{ color: palette.muted, fontWeight: '400' }}> · jeśli dotyczy</Text> : null}
              </Text>
              <Text style={{ fontSize: 12, color: st.tone, marginTop: 2, fontWeight: '700' }}>{st.label}</Text>
              {doc.status === 'rejected' && doc.note ? <Text style={{ fontSize: 12, color: palette.bad, marginTop: 2 }}>{doc.note}</Text> : null}
              {doc.status === 'missing' && doc.hint ? <Text style={{ fontSize: 12, color: palette.muted, marginTop: 2, lineHeight: 16 }}>{doc.hint}</Text> : null}
              {doc.fileName && doc.fileUrl ? (
                <Pressable onPress={() => void Linking.openURL(doc.fileUrl as string)} hitSlop={6}>
                  <Text style={{ fontSize: 12, color: palette.accent, marginTop: 3 }} numberOfLines={1}>
                    {doc.fileName}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            {canUpload && doc.status !== 'accepted' ? (
              busyKey === doc.key ? (
                <ActivityIndicator color={palette.accent} />
              ) : (
                <Pressable onPress={() => void upload(doc)} style={[styles.add, { backgroundColor: palette.isDark ? palette.gold : '#000' }]} hitSlop={6}>
                  <Ionicons name={doc.status === 'missing' ? 'add' : 'refresh'} size={18} color={palette.isDark ? '#000' : '#D8C3A0'} />
                </Pressable>
              )
            ) : null}
          </View>
        );
      })}
    </LuxCard>
  );
}

const styles = StyleSheet.create({
  progress: { height: 6, borderRadius: 3, marginTop: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 4 },
  add: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});

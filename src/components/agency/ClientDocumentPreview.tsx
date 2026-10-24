import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { getSafeWebView } from '../messaging/safeWebView';
import { getSafeQuickLook } from '../../utils/safeQuickLook';
import { normalizeContactMediaUrl } from '../../utils/contactAttachment';

export type PreviewableDocument = {
  label: string;
  fileUrl: string | null;
  fileName: string | null;
  mimeType?: string | null;
  uploadedAt?: string | null;
};

export function documentKind(doc: { fileName?: string | null; mimeType?: string | null; fileUrl?: string | null }) {
  const name = `${doc.fileName || ''} ${doc.fileUrl || ''}`.toLowerCase();
  const mime = String(doc.mimeType || '').toLowerCase();
  if (mime.startsWith('image/') || /\.(jpe?g|png|gif|webp|heic|heif)(\s|$|\?)/.test(name)) return 'image' as const;
  if (mime === 'application/pdf' || /\.pdf(\s|$|\?)/.test(name)) return 'pdf' as const;
  return 'other' as const;
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

/** Ściąga plik do cache (z rozszerzeniem), żeby WebView / QuickLook otworzyły go lokalnie. */
async function ensureLocalFile(url: string, fileName: string | null): Promise<string> {
  const ext = (fileName || url).split('?')[0].split('.').pop()?.toLowerCase().slice(0, 6) || 'bin';
  const dest = `${FileSystem.cacheDirectory ?? ''}client-doc-${hash(url)}.${ext}`;
  const info = await FileSystem.getInfoAsync(dest);
  if (info.exists && (info as { size?: number }).size) return dest;
  const result = await FileSystem.downloadAsync(url, dest);
  if (result.status >= 400) throw new Error(`Serwer zwrócił błąd ${result.status} — plik mógł zostać usunięty.`);
  return result.uri || dest;
}

/**
 * Podgląd dokumentu od klienta w aplikacji agenta: zdjęcie z powiększaniem albo PDF / Word
 * w przeglądarce dokumentów (lokalna kopia), do tego Podgląd systemowy, udostępnianie i Safari.
 */
export default function ClientDocumentPreview({
  doc,
  onClose,
  footer,
}: {
  doc: PreviewableDocument | null;
  onClose: () => void;
  /** np. przyciski „OK” / „Do poprawy” pod podglądem */
  footer?: React.ReactNode;
}) {
  const { width, height } = useWindowDimensions();
  const WebView = useMemo(() => getSafeWebView(), []);
  const url = doc?.fileUrl ? normalizeContactMediaUrl(doc.fileUrl) : null;
  const kind = doc ? documentKind(doc) : 'other';
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLocalUri(null);
    setError(null);
    if (!url || kind === 'image') return;
    setLoading(true);
    ensureLocalFile(url, doc?.fileName ?? null)
      .then((uri) => {
        if (!cancelled) setLocalUri(uri);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Nie udało się pobrać pliku.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [url, kind, doc?.fileName]);

  const openQuickLook = async () => {
    const ql = getSafeQuickLook();
    if (!url) return;
    try {
      const uri = localUri || (await ensureLocalFile(url, doc?.fileName ?? null));
      if (ql) await ql.previewFile({ uri });
      else await Linking.openURL(url);
    } catch {
      void Linking.openURL(url);
    }
  };

  return (
    <Modal visible={Boolean(doc)} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10} style={styles.headerBtn} accessibilityLabel="Zamknij">
            <Ionicons name="chevron-down" size={22} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>
              {doc?.label}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              {doc?.fileName || 'Plik od klienta'}
              {doc?.uploadedAt
                ? ` · ${new Date(doc.uploadedAt).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
                : ''}
            </Text>
          </View>
          {url ? (
            <>
              <Pressable onPress={() => void openQuickLook()} hitSlop={10} style={styles.headerBtn} accessibilityLabel="Otwórz w Podglądzie">
                <Ionicons name="expand-outline" size={20} color="#fff" />
              </Pressable>
              <Pressable onPress={() => void Share.share(Platform.OS === 'ios' ? { url: localUri || url } : { message: url })} hitSlop={10} style={styles.headerBtn} accessibilityLabel="Udostępnij">
                <Ionicons name="share-outline" size={20} color="#fff" />
              </Pressable>
            </>
          ) : null}
        </View>

        <View style={{ flex: 1 }}>
          {!url ? (
            <Text style={styles.msg}>Klient nie dołączył jeszcze pliku.</Text>
          ) : kind === 'image' ? (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}
              maximumZoomScale={5}
              minimumZoomScale={1}
              centerContent
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            >
              <Image source={{ uri: url }} style={{ width, height: height * 0.78 }} contentFit="contain" transition={150} />
            </ScrollView>
          ) : loading ? (
            <View style={styles.center}>
              <ActivityIndicator color="#D8C3A0" />
              <Text style={styles.msg}>Pobieram dokument…</Text>
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Ionicons name="alert-circle-outline" size={34} color="#FF453A" />
              <Text style={styles.msg}>{error}</Text>
              <Pressable onPress={() => void Linking.openURL(url)} style={styles.pill}>
                <Text style={styles.pillText}>Otwórz w Safari</Text>
              </Pressable>
            </View>
          ) : localUri && WebView ? (
            <WebView
              source={{ uri: localUri }}
              style={{ flex: 1, backgroundColor: '#1c1c1e' }}
              originWhitelist={['*']}
              allowFileAccess
              allowingReadAccessToURL={FileSystem.cacheDirectory ?? undefined}
              scalesPageToFit
              startInLoadingState
            />
          ) : (
            <View style={styles.center}>
              <Ionicons name="document-text-outline" size={40} color="#D8C3A0" />
              <Text style={styles.msg}>{kind === 'pdf' ? 'Dokument PDF' : 'Dokument'} gotowy do otwarcia.</Text>
              <Pressable onPress={() => void openQuickLook()} style={styles.pill}>
                <Text style={styles.pillText}>Otwórz podgląd</Text>
              </Pressable>
            </View>
          )}
        </View>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0b0c' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  headerBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  title: { color: '#fff', fontSize: 16, fontWeight: '800' },
  sub: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  msg: { color: 'rgba(255,255,255,0.75)', fontSize: 14, textAlign: 'center' },
  pill: { backgroundColor: '#D8C3A0', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
  pillText: { color: '#000', fontWeight: '800', fontSize: 14 },
  footer: { padding: 14, paddingBottom: 28, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.12)' },
});

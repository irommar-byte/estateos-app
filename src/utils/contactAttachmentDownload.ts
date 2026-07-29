import { Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { normalizeContactMediaUrl } from './contactAttachment';

function safeFileName(name: string, fallback = 'zalacznik'): string {
  const cleaned = String(name || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/[^\w.\-ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]+/gi, '_')
    .slice(0, 80);
  return cleaned || `${fallback}_${Date.now()}`;
}

function extFromMime(mimeType?: string | null): string {
  const mime = String(mimeType || '').toLowerCase();
  if (mime.includes('pdf')) return '.pdf';
  if (mime.includes('png')) return '.png';
  if (mime.includes('gif')) return '.gif';
  if (mime.includes('webp')) return '.webp';
  if (mime.includes('jpeg') || mime.includes('jpg')) return '.jpg';
  if (mime.includes('mp4')) return '.mp4';
  if (mime.includes('quicktime') || mime.includes('mov')) return '.mov';
  if (mime.includes('mpeg') || mime.includes('mp3')) return '.mp3';
  if (mime.includes('m4a')) return '.m4a';
  if (mime.includes('wav')) return '.wav';
  return '';
}

function ensureExtension(name: string, mimeType?: string | null): string {
  if (/\.[a-z0-9]{2,5}$/i.test(name)) return name;
  return `${name}${extFromMime(mimeType)}`;
}

async function downloadToCache(url: string, dest: string): Promise<string> {
  const result = await FileSystem.downloadAsync(url, dest);
  if (!result?.uri) throw new Error('Brak URI po pobraniu');
  if (result.status != null && result.status >= 400) {
    throw new Error(`HTTP ${result.status}`);
  }
  return result.uri;
}

/** Fallback: fetch → base64 → zapis lokalny (gdy native downloadAsync zawiedzie). */
async function fetchToCache(url: string, dest: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = await res.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    for (let j = 0; j < slice.length; j += 1) binary += String.fromCharCode(slice[j]!);
  }
  if (typeof globalThis.btoa !== 'function') {
    throw new Error('Brak btoa');
  }
  const base64 = globalThis.btoa(binary);
  await FileSystem.writeAsStringAsync(dest, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return dest;
}

/**
 * Pobiera załącznik do cache i otwiera natywny sheet „Udostępnij / Zapisz w Plikach”.
 */
export async function downloadContactAttachment(params: {
  url: string;
  name?: string;
  mimeType?: string | null;
  labels?: {
    failedTitle?: string;
    failedMessage?: string;
    unavailable?: string;
  };
}): Promise<boolean> {
  const labels = {
    failedTitle: params.labels?.failedTitle || 'Pobieranie',
    failedMessage: params.labels?.failedMessage || 'Nie udało się pobrać załącznika.',
    unavailable: params.labels?.unavailable || 'Udostępnianie plików jest niedostępne na tym urządzeniu.',
  };

  try {
    const resolvedUrl = normalizeContactMediaUrl(params.url);
    if (!resolvedUrl) throw new Error('Brak URL');

    const fileName = ensureExtension(safeFileName(params.name || 'zalacznik'), params.mimeType);
    const cacheRoot = FileSystem.cacheDirectory;
    if (!cacheRoot) throw new Error('Brak katalogu cache');
    const dest = `${cacheRoot}dl-${Date.now()}-${fileName}`;

    let localUri = resolvedUrl;
    if (resolvedUrl.startsWith('file://') || resolvedUrl.startsWith('content://')) {
      localUri = resolvedUrl;
    } else {
      try {
        localUri = await downloadToCache(resolvedUrl, dest);
      } catch {
        localUri = await fetchToCache(resolvedUrl, dest);
      }
    }

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert(labels.failedTitle, labels.unavailable);
      return false;
    }

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await Sharing.shareAsync(localUri, {
        mimeType: params.mimeType || undefined,
        dialogTitle: fileName,
        ...(Platform.OS === 'ios' ? { UTI: 'public.data' } : {}),
      });
    } catch {
      // Anulowanie sheetu przez użytkownika nie jest błędem pobierania.
    }
    return true;
  } catch {
    Alert.alert(labels.failedTitle, labels.failedMessage);
    return false;
  }
}

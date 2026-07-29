import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { getSafeQuickLook } from './safeQuickLook';
import { normalizeContactMediaUrl } from './contactAttachment';

const thumbCache = new Map<string, string>();

function cacheKey(url: string, w: number, h: number) {
  return `${url}|${Math.round(w)}x${Math.round(h)}`;
}

function hashUrl(url: string): string {
  let h = 0;
  for (let i = 0; i < url.length; i += 1) h = (h * 31 + url.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

/** Lokalny plik PDF (ściąga remote do cache). */
export async function ensureLocalPdf(url: string): Promise<string> {
  const resolved = normalizeContactMediaUrl(url) || url;
  if (resolved.startsWith('file://')) return resolved;
  if (resolved.startsWith('content://')) return resolved;
  if (!resolved.startsWith('http')) {
    return resolved.startsWith('/') ? `file://${resolved}` : resolved;
  }

  const dest = `${FileSystem.cacheDirectory ?? ''}contact-pdf-${hashUrl(resolved)}.pdf`;
  const info = await FileSystem.getInfoAsync(dest);
  if (info.exists) return dest.startsWith('file://') ? dest : `file://${dest}`;

  const result = await FileSystem.downloadAsync(resolved, dest);
  const uri = result.uri || dest;
  return uri.startsWith('file://') ? uri : `file://${uri}`;
}

function toQuickLookUri(localUri: string): string {
  // Native QLThumbnailGenerator akceptuje zarówno file:// jak i ścieżkę absolutną.
  if (localUri.startsWith('file://')) return localUri;
  if (localUri.startsWith('/')) return `file://${localUri}`;
  return localUri;
}

export async function resolveContactPdfThumbnail(
  url: string,
  width: number,
  height: number,
): Promise<string | null> {
  const key = cacheKey(url, width, height);
  const hit = thumbCache.get(key);
  if (hit) return hit;

  const quickLook = getSafeQuickLook();
  if (!quickLook || Platform.OS !== 'ios') return null;

  try {
    const localUri = await ensureLocalPdf(url);
    const thumb = await quickLook.generateThumbnail({
      uri: toQuickLookUri(localUri),
      size: {
        width: Math.max(80, Math.round(width)),
        height: Math.max(100, Math.round(height)),
      },
      scale: 2,
    });
    const uri = thumb.uri.startsWith('file://') ? thumb.uri : `file://${thumb.uri}`;
    thumbCache.set(key, uri);
    return uri;
  } catch {
    // Drugi strzał: ścieżka bez schematu (starsze API).
    try {
      const localUri = await ensureLocalPdf(url);
      const bare = localUri.replace(/^file:\/\//, '');
      const thumb = await quickLook.generateThumbnail({
        uri: bare,
        size: {
          width: Math.max(80, Math.round(width)),
          height: Math.max(100, Math.round(height)),
        },
        scale: 2,
      });
      const uri = thumb.uri.startsWith('file://') ? thumb.uri : `file://${thumb.uri}`;
      thumbCache.set(key, uri);
      return uri;
    } catch {
      return null;
    }
  }
}

export async function openContactPdfPreview(url: string): Promise<boolean> {
  const quickLook = getSafeQuickLook();
  if (!quickLook) return false;
  try {
    // previewFile umie remote; lokalnie jest pewniej.
    let uri = url;
    try {
      uri = await ensureLocalPdf(url);
    } catch {
      uri = url;
    }
    await quickLook.previewFile({ uri });
    return true;
  } catch {
    return false;
  }
}

/** URI do wbudowanego podglądu (WebView) — lokalny plik gdy da się ściągnąć. */
export async function resolveContactPdfPreviewUri(url: string): Promise<string> {
  if (Platform.OS === 'android' && url.startsWith('http')) {
    return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}`;
  }
  try {
    return await ensureLocalPdf(url);
  } catch {
    return url;
  }
}

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { getSafeQuickLook } from './safeQuickLook';

const thumbCache = new Map<string, string>();

function cacheKey(url: string, w: number, h: number) {
  return `${url}|${w}x${h}`;
}

async function ensureLocalPdf(url: string): Promise<string> {
  if (url.startsWith('file://')) return url;
  if (url.startsWith('content://')) return url;
  if (!url.startsWith('http')) return url.startsWith('/') ? `file://${url}` : url;

  const safeName = encodeURIComponent(url).slice(0, 120);
  const dest = `${FileSystem.cacheDirectory ?? ''}contact-pdf-${safeName}.pdf`;
  const info = await FileSystem.getInfoAsync(dest);
  if (info.exists) return dest;
  const result = await FileSystem.downloadAsync(url, dest);
  return result.uri;
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
    const pathForNative = localUri.startsWith('file://') ? localUri.replace('file://', '') : localUri;
    const thumb = await quickLook.generateThumbnail({
      uri: pathForNative,
      size: { width, height },
      scale: 2,
    });
    const uri = thumb.uri.startsWith('file://') ? thumb.uri : `file://${thumb.uri}`;
    thumbCache.set(key, uri);
    return uri;
  } catch {
    return null;
  }
}

export async function openContactPdfPreview(url: string): Promise<boolean> {
  const quickLook = getSafeQuickLook();
  if (!quickLook) return false;
  try {
    await quickLook.previewFile({ uri: url });
    return true;
  } catch {
    return false;
  }
}

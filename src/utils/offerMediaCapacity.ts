import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

/** Limit wysyłki na serwer (zgodny z backendem / Step6 upload). */
export const OFFER_MEDIA_UPLOAD_CAP_MB = 20;
export const OFFER_MEDIA_UPLOAD_CAP_BYTES = OFFER_MEDIA_UPLOAD_CAP_MB * 1024 * 1024;

/**
 * Rezerwa tylko na urządzeniu przy dobieraniu zdjęć (konwersja HEIC→JPEG).
 * Nie zwiększa limitu na serwerze — pozwala dodać cięższe pliki źródłowe,
 * które po kompresji zmieszczą się w 20 MB.
 */
export const OFFER_MEDIA_CONVERSION_RESERVE_MB = 5;
export const OFFER_MEDIA_CONVERSION_RESERVE_BYTES =
  OFFER_MEDIA_CONVERSION_RESERVE_MB * 1024 * 1024;

export const OFFER_MEDIA_PICKER_BUDGET_BYTES =
  OFFER_MEDIA_UPLOAD_CAP_BYTES + OFFER_MEDIA_CONVERSION_RESERVE_BYTES;

export const OFFER_MEDIA_MAX_IMAGES = 20;

const FALLBACK_BYTES_PER_IMAGE = Math.round(0.9 * 1024 * 1024);

export function sumEstimatedUploadBytes(
  uris: string[],
  sizes: Record<string, number> | undefined,
): number {
  const map = sizes || {};
  return uris.reduce((acc, uri) => acc + (map[uri] ?? FALLBACK_BYTES_PER_IMAGE), 0);
}

export function pruneImageByteSizes(
  images: string[],
  sizes: Record<string, number>,
): Record<string, number> {
  const unique = [...new Set(images)];
  const out: Record<string, number> = {};
  for (const uri of unique) {
    const b = sizes[uri];
    if (typeof b === 'number' && b > 0) out[uri] = Math.round(b);
  }
  return out;
}

function uriLooksHeic(uri: string): boolean {
  const lower = uri.toLowerCase();
  return lower.endsWith('.heic') || lower.endsWith('.heif');
}

/**
 * Szacunek rozmiaru po konwersji (jak Step6: JPEG compress 0.8).
 * Przy błędzie pomiaru HEIC — konserwatywny górny limit, nie 2.4× rozmiar z biblioteki.
 */
export async function estimateBytesForDraftImage(
  uri: string,
  pickerFileSize?: number | null,
): Promise<number> {
  const looksHeic = uriLooksHeic(uri);

  try {
    let measureUri = uri;
    let tempConvert: string | null = null;
    if (looksHeic) {
      const converted = await ImageManipulator.manipulateAsync(uri, [], {
        format: ImageManipulator.SaveFormat.JPEG,
        compress: 0.8,
      });
      measureUri = converted.uri;
      tempConvert = converted.uri;
    }

    const info = await FileSystem.getInfoAsync(measureUri);
    if (info.exists && typeof info.size === 'number' && info.size > 0) {
      if (tempConvert) {
        FileSystem.deleteAsync(tempConvert, { idempotent: true }).catch(() => {});
      }
      return Math.round(info.size);
    }

    if (tempConvert) {
      FileSystem.deleteAsync(tempConvert, { idempotent: true }).catch(() => {});
    }
  } catch {
    // fallbacki poniżej
  }

  if (typeof pickerFileSize === 'number' && pickerFileSize > 0) {
    if (looksHeic) {
      /** HEIC w bibliotece bywa 5–20 MB, JPG po compress ~0.5–2 MB. */
      const capped = Math.min(
        Math.round(pickerFileSize * 0.22 + 380 * 1024),
        Math.round(2.2 * 1024 * 1024),
      );
      return Math.max(capped, Math.round(420 * 1024));
    }
    return Math.round(pickerFileSize);
  }

  return looksHeic ? Math.round(1.4 * FALLBACK_BYTES_PER_IMAGE) : FALLBACK_BYTES_PER_IMAGE;
}

export type DraftImageCapacityRejectReason = 'upload_cap' | 'picker_budget';

export function canAcceptDraftImage(params: {
  currentUris: string[];
  sizes: Record<string, number>;
  newEstimatedBytes: number;
  pickerReportedBytes?: number | null;
  newUri?: string;
}): { ok: true } | { ok: false; reason: DraftImageCapacityRejectReason } {
  const running = sumEstimatedUploadBytes(params.currentUris, params.sizes);
  const nextUpload = running + params.newEstimatedBytes;

  if (nextUpload > OFFER_MEDIA_UPLOAD_CAP_BYTES) {
    return { ok: false, reason: 'upload_cap' };
  }

  const pickerBytes = params.pickerReportedBytes ?? 0;
  const heic = params.newUri ? uriLooksHeic(params.newUri) : false;
  if (heic && pickerBytes > 2 * 1024 * 1024) {
    const optimisticAdded = Math.min(
      params.newEstimatedBytes,
      Math.round(pickerBytes * 0.2 + 400 * 1024),
    );
    if (running + optimisticAdded > OFFER_MEDIA_PICKER_BUDGET_BYTES) {
      return { ok: false, reason: 'picker_budget' };
    }
  }

  return { ok: true };
}

export function formatMediaCapacityAlert(reason: DraftImageCapacityRejectReason): string {
  const uploadMb = OFFER_MEDIA_UPLOAD_CAP_MB;
  const reserveMb = OFFER_MEDIA_CONVERSION_RESERVE_MB;
  if (reason === 'picker_budget') {
    return (
      `Zestaw zdjęć jest zbyt duży na tym etapie (limit wysyłki ${uploadMb} MB).` +
      `\nDuże pliki HEIC są najpierw konwertowane na urządzeniu — usuń kilka zdjęć z listy lub dodawaj je pojedynczo.` +
      `\n(Rezerwa ${reserveMb} MB służy tylko konwersji, nie zwiększa limitu na serwerze.)`
    );
  }
  return (
    `Po konwersji (np. HEIC→JPEG) zestaw przekracza limit wysyłki ${uploadMb} MB.` +
    `\nUsuń część zdjęć z listy lub wybierz mniejsze pliki.`
  );
}

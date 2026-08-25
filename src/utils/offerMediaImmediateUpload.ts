import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { API_URL } from '../config/network';
import {
  OFFER_MEDIA_UPLOAD_CAP_BYTES,
  OFFER_MEDIA_UPLOAD_CAP_MB,
  estimateBytesForDraftImage,
} from './offerMediaCapacity';

export type OfferMediaUsage = {
  usedBytes: number;
  freeBytes: number;
  limitBytes: number;
  usedMb: number;
  freeMb: number;
  limitMb: number;
  imageCount?: number;
  maxImages?: number;
};

export type ImmediateUploadResult = {
  url: string;
  path: string;
  localBytes: number;
  usage?: OfferMediaUsage;
};

function parseUploadErrorPayload(text: string): string {
  const raw = String(text || '').trim();
  if (!raw) return 'Upload odrzucony przez serwer.';
  try {
    const json = JSON.parse(raw);
    const msg = json?.error || json?.message;
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
  } catch {
    /* plain text */
  }
  if (raw.includes('limit folderu') || raw.includes('Brak miejsca')) {
    return `Brak miejsca dla tej oferty (limit ${OFFER_MEDIA_UPLOAD_CAP_MB} MB). Usuń zdjęcie, żeby zwolnić miejsce.`;
  }
  return raw.length > 280 ? `${raw.slice(0, 280)}…` : raw;
}

async function prepareJpegForUpload(localUri: string): Promise<{ uri: string; filename: string; mime: string }> {
  let uri = localUri;
  let filename = localUri.split('/').pop() || `image_${Date.now()}.jpg`;
  const lower = localUri.toLowerCase();
  const isHeic = lower.endsWith('.heic') || lower.endsWith('.heif');
  if (isHeic) {
    const converted = await ImageManipulator.manipulateAsync(localUri, [], {
      format: ImageManipulator.SaveFormat.JPEG,
      compress: 0.88,
    });
    uri = converted.uri;
    filename = filename.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg');
  } else if (!filename.match(/\.(jpg|jpeg|png|webp)$/i)) {
    filename = `${filename}.jpg`;
  }
  return { uri, filename, mime: 'image/jpeg' };
}

/**
 * Upload zdjęcia oferty z prawdziwym paskiem postępu (XHR upload.onprogress).
 * Backend od razu dopisuje plik do folderu oferty i do listy `images`.
 */
export function uploadOfferImageImmediate(options: {
  offerId: number;
  token: string;
  localUri: string;
  onProgress?: (percent: number) => void;
}): Promise<ImmediateUploadResult> {
  const { offerId, token, localUri, onProgress } = options;

  return (async () => {
    const prepared = await prepareJpegForUpload(localUri);
    const localBytes = await estimateBytesForDraftImage(prepared.uri, null);

    return await new Promise<ImmediateUploadResult>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const endpoint = `${API_URL}/api/upload/mobile`;
      xhr.open('POST', endpoint);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.setRequestHeader('User-Agent', `EstateOS-Mobile/${Platform.OS}`);

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable || !onProgress) return;
        const pct = Math.max(0, Math.min(99, Math.round((event.loaded / event.total) * 100)));
        onProgress(pct);
      };

      xhr.onerror = () => reject(new Error('Brak połączenia podczas wysyłania zdjęcia.'));
      xhr.ontimeout = () => reject(new Error('Przekroczono limit czasu wysyłania zdjęcia.'));
      xhr.timeout = 120_000;

      xhr.onload = () => {
        const text = String(xhr.responseText || '');
        let json: any = {};
        try {
          json = text ? JSON.parse(text) : {};
        } catch {
          json = { _raw: text };
        }

        if (xhr.status < 200 || xhr.status >= 300 || json?.success === false) {
          reject(new Error(parseUploadErrorPayload(text || JSON.stringify(json))));
          return;
        }

        const path = String(json?.path || json?.url || '').trim();
        if (!path) {
          reject(new Error('Serwer nie zwrócił ścieżki zdjęcia.'));
          return;
        }

        onProgress?.(100);
        const usage: OfferMediaUsage | undefined =
          typeof json.usedBytes === 'number'
            ? {
                usedBytes: Number(json.usedBytes) || 0,
                freeBytes: Number(json.freeBytes) || 0,
                limitBytes: Number(json.limitBytes) || OFFER_MEDIA_UPLOAD_CAP_BYTES,
                usedMb: Number(json.usedMb) || 0,
                freeMb: Number(json.freeMb) || 0,
                limitMb: Number(json.limitMb) || OFFER_MEDIA_UPLOAD_CAP_MB,
              }
            : undefined;

        resolve({
          url: path.startsWith('http') ? path : `${API_URL}${path}`,
          path: path.startsWith('http') ? path.replace(API_URL, '') : path,
          localBytes,
          usage,
        });
      };

      const formData = new FormData();
      formData.append('offerId', String(offerId));
      formData.append('file', {
        uri: prepared.uri,
        name: prepared.filename,
        type: prepared.mime,
      } as any);
      xhr.send(formData);
    });
  })();
}

export async function fetchOfferMediaUsage(options: {
  offerId: number;
  token: string;
}): Promise<OfferMediaUsage | null> {
  try {
    const res = await fetch(`${API_URL}/api/mobile/v1/offers/${options.offerId}/media`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${options.token}`,
      },
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json || json.success === false) return null;
    return {
      usedBytes: Number(json.usedBytes) || 0,
      freeBytes: Number(json.freeBytes) || 0,
      limitBytes: Number(json.limitBytes) || OFFER_MEDIA_UPLOAD_CAP_BYTES,
      usedMb: Number(json.usedMb) || 0,
      freeMb: Number(json.freeMb) || 0,
      limitMb: Number(json.limitMb) || OFFER_MEDIA_UPLOAD_CAP_MB,
      imageCount: Number(json.imageCount) || 0,
      maxImages: Number(json.maxImages) || 20,
    };
  } catch {
    return null;
  }
}

/** Natychmiastowe usunięcie zdjęć z dysku serwera (zwalnia limit folderu). */
export async function deleteOfferMediaImmediate(options: {
  offerId: number;
  token: string;
  urls: string[];
}): Promise<OfferMediaUsage & { images: string[] }> {
  const res = await fetch(`${API_URL}/api/mobile/v1/offers/${options.offerId}/media`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.token}`,
    },
    body: JSON.stringify({ remove: options.urls }),
  });
  const text = await res.text().catch(() => '');
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { _raw: text };
  }
  if (!res.ok || json?.success === false) {
    throw new Error(parseUploadErrorPayload(text || JSON.stringify(json)));
  }
  return {
    images: Array.isArray(json.images) ? json.images.map(String) : [],
    usedBytes: Number(json.usedBytes) || 0,
    freeBytes: Number(json.freeBytes) || 0,
    limitBytes: Number(json.limitBytes) || OFFER_MEDIA_UPLOAD_CAP_BYTES,
    usedMb: Number(json.usedMb) || 0,
    freeMb: Number(json.freeMb) || 0,
    limitMb: Number(json.limitMb) || OFFER_MEDIA_UPLOAD_CAP_MB,
    imageCount: Number(json.imageCount) || 0,
    maxImages: Number(json.maxImages) || 20,
  };
}

export async function purgeOfferGalleryImmediate(options: {
  offerId: number;
  token: string;
}): Promise<OfferMediaUsage> {
  const res = await fetch(`${API_URL}/api/offers/${options.offerId}/gallery`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.token}`,
    },
    body: JSON.stringify({ confirm: true }),
  });
  const text = await res.text().catch(() => '');
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { _raw: text };
  }
  if (!res.ok || json?.success === false) {
    throw new Error(parseUploadErrorPayload(text || JSON.stringify(json)));
  }
  return {
    usedBytes: Number(json.usedBytes) || 0,
    freeBytes: Number(json.remainingBytes ?? json.freeBytes) || 0,
    limitBytes: Number(json.maxBytes ?? json.limitBytes) || OFFER_MEDIA_UPLOAD_CAP_BYTES,
    usedMb: Number(((Number(json.usedBytes) || 0) / (1024 * 1024)).toFixed(2)),
    freeMb: Number(((Number(json.remainingBytes ?? json.freeBytes) || 0) / (1024 * 1024)).toFixed(2)),
    limitMb: Math.round((Number(json.maxBytes ?? json.limitBytes) || OFFER_MEDIA_UPLOAD_CAP_BYTES) / (1024 * 1024)),
    imageCount: Number(json.usedImages ?? json.imageCount) || 0,
    maxImages: Number(json.maxImages) || 20,
  };
}

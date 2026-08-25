import * as ImagePicker from 'expo-image-picker';

/**
 * Nie transkoduj HEIC przy wyborze z Kliszy — `quality < 1` i tryb Automatic
 * spłaszczają Apple HDR (gain map) do JPEG SDR.
 */
export const OFFER_PHOTO_LIBRARY_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: false,
  quality: 1,
  preferredAssetRepresentationMode:
    ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
};

export function offerPhotoUploadParts(params: {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}): { uri: string; filename: string; mime: string } {
  const uri = params.uri;
  const rawName = String(params.fileName || uri.split('/').pop() || `image_${Date.now()}`).trim();
  const lowerName = rawName.toLowerCase();
  const mimeHint = String(params.mimeType || '').toLowerCase();

  if (mimeHint.includes('heic') || mimeHint.includes('heif') || /\.hei[cf]$/i.test(lowerName)) {
    const filename = lowerName.endsWith('.heif')
      ? rawName.replace(/\.heif$/i, '.heic')
      : /\.heic$/i.test(lowerName)
        ? rawName
        : `${rawName.replace(/\.[^.]+$/, '')}.heic`;
    return { uri, filename, mime: 'image/heic' };
  }
  if (mimeHint.includes('png') || lowerName.endsWith('.png')) {
    return { uri, filename: lowerName.endsWith('.png') ? rawName : `${rawName}.png`, mime: 'image/png' };
  }
  if (mimeHint.includes('webp') || lowerName.endsWith('.webp')) {
    return { uri, filename: lowerName.endsWith('.webp') ? rawName : `${rawName}.webp`, mime: 'image/webp' };
  }
  const filename = /\.(jpe?g)$/i.test(lowerName) ? rawName : `${rawName.replace(/\.[^.]+$/, '')}.jpg`;
  return { uri, filename, mime: 'image/jpeg' };
}

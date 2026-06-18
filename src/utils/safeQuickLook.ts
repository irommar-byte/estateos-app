import { requireOptionalNativeModule } from 'expo-modules-core';

export type QuickLookModule = {
  generateThumbnail(options: {
    uri: string;
    size: { width: number; height: number };
    scale?: number;
  }): Promise<{ uri: string; width: number; height: number }>;
  previewFile(options: { uri: string; requestOptions?: { headers?: Record<string, string> } }): Promise<void>;
};

let cached: QuickLookModule | null | undefined;

export function getSafeQuickLook(): QuickLookModule | null {
  if (cached !== undefined) return cached;
  try {
    cached = requireOptionalNativeModule<QuickLookModule>('ExpoQuickLook');
  } catch {
    cached = null;
  }
  return cached;
}

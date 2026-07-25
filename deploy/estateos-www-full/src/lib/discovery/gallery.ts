import crypto from 'crypto';
import {
  DISCOVERY_GALLERY_ALGORITHM_VERSION,
  type DiscoveryGalleryPlan,
  type GalleryAssetRole,
} from './types';

function parseImages(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((value) => String(value || '').trim()).filter(Boolean);
    }
  } catch {
    // Legacy media can arrive as a comma-delimited string.
  }
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function sourceHash(assets: string[]): string {
  return crypto.createHash('sha256').update(assets.join('|')).digest('hex');
}

/**
 * Provider-agnostic deterministic gallery plan.
 *
 * It never suppresses an asset. Until the later embedding provider is connected,
 * it protects first-party listing order while assigning semantic roles that mobile
 * can render and later re-rank with vector evidence.
 */
export function planDiscoveryGallery(images: string | null): DiscoveryGalleryPlan {
  const orderedAssets = parseImages(images);
  const roleCycle: GalleryAssetRole[] = ['HERO', 'LAYOUT', 'LIGHT', 'CONTEXT', 'ADDITIONAL'];
  const assetRoles = orderedAssets.map((asset, index) => ({
    asset,
    role: roleCycle[Math.min(index, roleCycle.length - 1)],
  }));

  return {
    algorithmVersion: DISCOVERY_GALLERY_ALGORITHM_VERSION,
    sourceHash: sourceHash(orderedAssets),
    orderedAssets,
    assetRoles,
    status: 'READY',
  };
}

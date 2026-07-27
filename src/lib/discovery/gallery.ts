import crypto from 'crypto';
import {
  DISCOVERY_GALLERY_ALGORITHM_VERSION,
  type DiscoveryGalleryPlan,
  type GalleryAssetRole,
} from './types';

export const DISCOVERY_GALLERY_TASTE_VERSION = 'gallery-taste-v1';

export type DiscoveryGalleryTaste = {
  confidence?: number | null;
  dislikeReasons?: Array<{ key: string; value: number }> | null;
  /** Min confidence (0–1) before soft reordering kicks in. */
  minConfidence?: number;
};

function parseImages(raw: string | string[] | null | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((value) => String(value || '').trim()).filter(Boolean);
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((value) => String(value || '').trim()).filter(Boolean);
    }
  } catch {
    // Legacy media can arrive as a comma-delimited string.
  }
  return String(raw)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function sourceHash(assets: string[]): string {
  return crypto.createHash('sha256').update(assets.join('|')).digest('hex');
}

const ROLE_CYCLE: GalleryAssetRole[] = ['HERO', 'LAYOUT', 'LIGHT', 'CONTEXT', 'ADDITIONAL'];

function assignRoles(orderedAssets: string[]): Array<{ asset: string; role: GalleryAssetRole }> {
  return orderedAssets.map((asset, index) => ({
    asset,
    role: ROLE_CYCLE[Math.min(index, ROLE_CYCLE.length - 1)],
  }));
}

function preferredRestRoles(taste: DiscoveryGalleryTaste | null | undefined): GalleryAssetRole[] {
  const reasons = Array.isArray(taste?.dislikeReasons) ? taste!.dislikeReasons! : [];
  const top = [...reasons].sort((a, b) => Number(b.value) - Number(a.value))[0]?.key || '';
  const key = String(top).toUpperCase();

  // Soft bias: what the buyer keeps rejecting should surface earlier in the rest of the gallery.
  if (key === 'LAYOUT_MISMATCH') return ['LAYOUT', 'LIGHT', 'CONTEXT', 'ADDITIONAL'];
  if (key === 'LOCATION_MISMATCH') return ['CONTEXT', 'LAYOUT', 'LIGHT', 'ADDITIONAL'];
  if (key === 'QUALITY_LOW') return ['LIGHT', 'LAYOUT', 'CONTEXT', 'ADDITIONAL'];
  if (key === 'PRICE_TOO_HIGH') return ['LAYOUT', 'CONTEXT', 'LIGHT', 'ADDITIONAL'];
  return ['LAYOUT', 'LIGHT', 'CONTEXT', 'ADDITIONAL'];
}

function softReorderRest(rest: string[], preferred: GalleryAssetRole[]): string[] {
  if (rest.length <= 2) return rest;

  const bias = preferred[0] || 'LAYOUT';

  if (bias === 'LAYOUT') {
    // Room / plan rhythm often sits on even slots after hero — surface them first.
    const even = rest.filter((_, i) => i % 2 === 0);
    const odd = rest.filter((_, i) => i % 2 === 1);
    return [...even, ...odd];
  }

  if (bias === 'CONTEXT') {
    // Exterior / neighborhood frames are often later — pull the last third forward.
    const cut = Math.max(1, Math.floor((rest.length * 2) / 3));
    return [...rest.slice(cut), ...rest.slice(0, cut)];
  }

  if (bias === 'LIGHT') {
    // Brightness / quality reads mid-gallery — rotate mid to front.
    const mid = Math.floor(rest.length / 2);
    return [...rest.slice(mid), ...rest.slice(0, mid)];
  }

  // Default soft rotate — still quieter than a full shuffle.
  return [...rest.slice(1), rest[0]];
}

/**
 * Provider-agnostic gallery plan.
 *
 * - Never drops an asset.
 * - Always keeps the seller’s first photo as HERO.
 * - With enough Discovery confidence, softly reorders the remaining frames
 *   toward what the buyer still needs to see (layout / light / context).
 */
export function planDiscoveryGallery(
  images: string | string[] | null | undefined,
  taste?: DiscoveryGalleryTaste | null,
): DiscoveryGalleryPlan {
  const assets = parseImages(images);
  const minConfidence = typeof taste?.minConfidence === 'number' ? taste.minConfidence : 0.18;
  const confidence = Number(taste?.confidence ?? 0);
  const canPersonalize =
    Boolean(taste) &&
    Number.isFinite(confidence) &&
    confidence >= minConfidence &&
    assets.length >= 3;

  let orderedAssets = assets;
  let algorithmVersion = DISCOVERY_GALLERY_ALGORITHM_VERSION;

  if (canPersonalize) {
    const hero = assets[0];
    const rest = softReorderRest(assets.slice(1), preferredRestRoles(taste));
    orderedAssets = [hero, ...rest];
    algorithmVersion = DISCOVERY_GALLERY_TASTE_VERSION;
  }

  return {
    algorithmVersion,
    sourceHash: sourceHash(assets),
    orderedAssets,
    assetRoles: assignRoles(orderedAssets),
    status: 'READY',
  };
}

export function isPersonalizedGalleryPlan(plan: DiscoveryGalleryPlan | null | undefined): boolean {
  return Boolean(plan?.algorithmVersion?.startsWith('gallery-taste'));
}

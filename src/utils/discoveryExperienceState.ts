export type DiscoveryUndoState<T> = {
  item: T;
  expiresAt: number;
};

export function createDiscoveryUndo<T>(item: T, now = Date.now(), windowMs = 7_000): DiscoveryUndoState<T> {
  return { item, expiresAt: now + windowMs };
}

export function canUndoDiscovery<T>(state: DiscoveryUndoState<T> | null, now = Date.now()): state is DiscoveryUndoState<T> {
  return !!state && state.expiresAt > now;
}

/**
 * Reasons are deliberately sparse. The first two dislikes remain frictionless;
 * every third eligible decision opens a skippable care surface.
 */
export function shouldAskDiscoveryDislikeReason(dislikeCount: number): boolean {
  return dislikeCount > 0 && dislikeCount % 3 === 0;
}

export function resolveDiscoveryEntryRoute(firstEntrySeen: boolean): 'DiscoveryEntry' | 'EstateDiscovery' {
  return firstEntrySeen ? 'EstateDiscovery' : 'DiscoveryEntry';
}

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

/** Session counter for catalog / rail dislikes (survives remounts within app session). */
let catalogDislikePromptTick = 0;

/**
 * Returns true only when Intelligence should ask for a dislike reason from the brain orb.
 * Always advances the tick so consecutive “Nie dla mnie” stay mostly frictionless.
 */
export function shouldPromptCatalogDislikeViaBrain(): boolean {
  catalogDislikePromptTick += 1;
  return shouldAskDiscoveryDislikeReason(catalogDislikePromptTick);
}

export function resolveDiscoveryEntryRoute(firstEntrySeen: boolean): 'DiscoveryEntry' | 'EstateDiscovery' {
  return firstEntrySeen ? 'EstateDiscovery' : 'DiscoveryEntry';
}

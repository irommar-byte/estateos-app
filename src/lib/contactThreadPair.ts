/** Kanoniczna para użytkowników — min/max ID gwarantuje unikalność wątku 1:1. */
export function contactThreadPair(userA: number, userB: number): { userLowId: number; userHighId: number } {
  const a = Math.trunc(userA);
  const b = Math.trunc(userB);
  return a <= b ? { userLowId: a, userHighId: b } : { userLowId: b, userHighId: a };
}

export function contactPeerId(thread: { userLowId: number; userHighId: number }, viewerId: number): number {
  return thread.userLowId === viewerId ? thread.userHighId : thread.userLowId;
}

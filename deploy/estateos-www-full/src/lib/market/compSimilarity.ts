import type { MarketComp, ValuationSubject } from "@/lib/market/types";

/** Lower is a closer match to the subject (area, rooms, floor, then distance). */
export function compSimilarityScore(
  comp: Pick<MarketComp, "area" | "rooms" | "floor" | "distanceM">,
  subject: Pick<ValuationSubject, "area" | "rooms" | "floor">,
): number {
  const areaPenalty =
    comp.area != null && subject.area > 0
      ? Math.abs(comp.area - subject.area) / subject.area
      : 0.28;
  const roomsPenalty =
    subject.rooms != null && comp.rooms != null
      ? Math.abs(comp.rooms - subject.rooms)
      : 0.65;
  const floorPenalty =
    subject.floor != null && comp.floor != null
      ? Math.min(4, Math.abs(comp.floor - subject.floor)) / 4
      : 0.4;
  const distPenalty = Math.min(1, Math.max(0, comp.distanceM) / 2000);
  return areaPenalty * 4 + roomsPenalty * 1.45 + floorPenalty * 0.75 + distPenalty * 1.05;
}

export function sortCompsBySimilarity<T extends MarketComp>(
  comps: T[],
  subject: Pick<ValuationSubject, "area" | "rooms" | "floor">,
): T[] {
  return [...comps].sort((a, b) => {
    const delta = compSimilarityScore(a, subject) - compSimilarityScore(b, subject);
    if (delta !== 0) return delta;
    return a.distanceM - b.distanceM;
  });
}

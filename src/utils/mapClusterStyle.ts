/** Shared sizing + label formatting for map pin clusters (Apple Maps–inspired tiers). */

export type ClusterMarkerDimensions = {
  outer: number;
  inner: number;
  fontSize: number;
};

export function resolveClusterMarkerDimensions(count: number): ClusterMarkerDimensions {
  if (count >= 100) return { outer: 74, inner: 56, fontSize: 17 };
  if (count >= 50) return { outer: 68, inner: 52, fontSize: 16 };
  if (count >= 25) return { outer: 62, inner: 48, fontSize: 15 };
  if (count >= 10) return { outer: 56, inner: 44, fontSize: 14 };
  if (count >= 4) return { outer: 50, inner: 39, fontSize: 13 };
  return { outer: 46, inner: 35, fontSize: 12.5 };
}

export function formatClusterCount(count: number): string {
  const n = Math.max(0, Math.floor(count));
  if (n >= 1000) return `${Math.floor(n / 100) / 10}k`;
  if (n >= 100) return '99+';
  return String(n);
}

export function parseFloorPlanExtraUrls(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item || "").trim()).filter(Boolean);
  }
  const text = String(raw).trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item || "").trim()).filter(Boolean);
    }
  } catch {
    // fallback csv
  }
  return text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function serializeFloorPlanExtraUrls(urls: string[]): string | null {
  const unique = [...new Set(urls.map((item) => String(item || "").trim()).filter(Boolean))];
  return unique.length ? JSON.stringify(unique) : null;
}

/** Wkleja z schowka URL (OtoDom lub dowolny http/https), jeśli pole jest puste. */
export async function pasteHttpUrlFromClipboard(
  apply: (value: string) => void,
  currentValue = "",
): Promise<boolean> {
  if (String(currentValue || "").trim()) return false;
  if (typeof navigator === "undefined" || !navigator.clipboard?.readText) return false;

  try {
    const text = String(await navigator.clipboard.readText()).trim();
    if (!text) return false;
    const looksLikeUrl =
      /^https?:\/\//i.test(text) ||
      /otodom\.pl/i.test(text) ||
      /^www\./i.test(text);
    if (!looksLikeUrl) return false;
    const normalized = /^https?:\/\//i.test(text) ? text : `https://${text.replace(/^\/\//, "")}`;
    apply(normalized);
    return true;
  } catch {
    return false;
  }
}

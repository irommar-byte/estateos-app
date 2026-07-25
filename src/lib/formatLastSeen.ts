/** Format last-seen timestamp for presence UI (pl / en / uk). */
export function formatLastSeenAt(
  lastLoginAt: Date | string | null | undefined,
  locale: string = "pl"
): string | null {
  if (!lastLoginAt) return null;
  const d = lastLoginAt instanceof Date ? lastLoginAt : new Date(lastLoginAt);
  if (!Number.isFinite(d.getTime())) return null;

  const loc = locale === "en" ? "en-GB" : locale === "uk" || locale === "ru" ? "uk-UA" : "pl-PL";
  const date = d.toLocaleDateString(loc, { day: "2-digit", month: "2-digit", year: "numeric" });
  const time = d.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${time}`;
}

export function formatPresenceOfflineLabel(
  lastLoginAt: Date | string | null | undefined,
  offlineWord: string,
  locale: string = "pl"
): string {
  const when = formatLastSeenAt(lastLoginAt, locale);
  if (!when) return offlineWord;
  if (locale === "en") return `Last seen ${when}`;
  if (locale === "uk" || locale === "ru") return `Був онлайн ${when}`;
  return `Ostatnio online ${when}`;
}

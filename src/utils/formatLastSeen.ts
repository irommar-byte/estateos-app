/** Format last-seen for presence UI (mobile). */
export function formatLastSeenAt(
  lastLoginAt: Date | string | null | undefined,
  locale: string = 'pl'
): string | null {
  if (!lastLoginAt) return null;
  const d = lastLoginAt instanceof Date ? lastLoginAt : new Date(lastLoginAt);
  if (!Number.isFinite(d.getTime())) return null;
  const loc = locale === 'en' ? 'en-GB' : locale === 'uk' || locale === 'ru' ? 'uk-UA' : 'pl-PL';
  const date = d.toLocaleDateString(loc, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time}`;
}

export function formatPresenceSubtitle(opts: {
  isOnline: boolean;
  lastSeenAt?: string | null;
  onlineLabel: string;
  offlineLabel: string;
  lastSeenPrefix: string;
  locale?: string;
}): string {
  if (opts.isOnline) return opts.onlineLabel;
  const when = formatLastSeenAt(opts.lastSeenAt, opts.locale || 'pl');
  if (when) return `${opts.lastSeenPrefix} ${when}`;
  return opts.offlineLabel;
}

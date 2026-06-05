export const ALLOWED_CONTACT_TAPBACKS = ['❤️', '👍', '👎', '😂', '😮', '‼️', '❓'] as const;

export type ContactReactionsMap = Record<string, string>;

export function parseContactReactions(raw: unknown): ContactReactionsMap {
  if (!raw) return {};
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const out: ContactReactionsMap = {};
    for (const [userId, emoji] of Object.entries(value as Record<string, unknown>)) {
      const e = String(emoji || '').trim();
      if (
        userId &&
        (ALLOWED_CONTACT_TAPBACKS as readonly string[]).includes(e)
      ) {
        out[String(userId)] = e;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeContactReactions(map: ContactReactionsMap): string | null {
  const clean: ContactReactionsMap = {};
  for (const [userId, emoji] of Object.entries(map)) {
    const e = String(emoji || '').trim();
    if ((ALLOWED_CONTACT_TAPBACKS as readonly string[]).includes(e)) {
      clean[String(userId)] = e;
    }
  }
  return Object.keys(clean).length ? JSON.stringify(clean) : null;
}

export function normalizeTapbackEmoji(raw: unknown): string | null {
  const e = String(raw ?? '').trim();
  if (!(ALLOWED_CONTACT_TAPBACKS as readonly string[]).includes(e)) return null;
  return e;
}

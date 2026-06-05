import { MESSAGE_TAPBACKS } from '../constants/messageTapbacks';

export type ContactReactionsMap = Record<string, string>;

export function parseContactReactions(raw: unknown): ContactReactionsMap {
  if (!raw) return {};
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const out: ContactReactionsMap = {};
    for (const [userId, emoji] of Object.entries(value as Record<string, unknown>)) {
      const e = String(emoji || '').trim();
      if (userId && MESSAGE_TAPBACKS.includes(e as (typeof MESSAGE_TAPBACKS)[number])) {
        out[String(userId)] = e;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function groupedReactionEmojis(reactions: ContactReactionsMap): string[] {
  const unique = new Set(Object.values(reactions).filter(Boolean));
  return MESSAGE_TAPBACKS.filter((e) => unique.has(e));
}

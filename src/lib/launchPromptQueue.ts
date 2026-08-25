/**
 * One launch modal at a time. Passkey → Intelligence enable → rating → upsell.
 * Without this, sheets stack on splash-end and the Intelligence prompt is buried forever.
 */

export const LAUNCH_PROMPT_ORDER = ['passkey', 'intelligence', 'rating', 'upsell'] as const;
export type LaunchPromptId = (typeof LAUNCH_PROMPT_ORDER)[number];

let wanted = new Set<LaunchPromptId>();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      /* quiet */
    }
  }
}

export function resetLaunchPromptQueueForTests() {
  wanted = new Set();
  emit();
}

export function requestLaunchPrompt(id: LaunchPromptId) {
  if (wanted.has(id)) return;
  wanted.add(id);
  emit();
}

export function releaseLaunchPrompt(id: LaunchPromptId) {
  if (!wanted.has(id)) return;
  wanted.delete(id);
  emit();
}

export function getActiveLaunchPrompt(): LaunchPromptId | null {
  return LAUNCH_PROMPT_ORDER.find((id) => wanted.has(id)) ?? null;
}

export function subscribeLaunchPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

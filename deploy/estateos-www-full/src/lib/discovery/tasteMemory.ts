export type RememberedTaste = "LIKE" | "DISLIKE" | "SERIOUS";

const KEY = "eos-discovery-taste-v1";

let memory: Record<number, RememberedTaste> = {};
const listeners = new Set<(map: Record<number, RememberedTaste>) => void>();
let hydrateStarted = false;

function emit() {
  listeners.forEach((listener) => listener(memory));
}

function isTaste(value: unknown): value is RememberedTaste {
  return value === "LIKE" || value === "DISLIKE" || value === "SERIOUS";
}

function readStorage(): Record<number, RememberedTaste> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const next: Record<number, RememberedTaste> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const id = Number(key);
      if (!Number.isFinite(id) || !isTaste(value)) continue;
      next[id] = value;
    }
    return next;
  } catch {
    return {};
  }
}

export function peekTasteMemory(): Record<number, RememberedTaste> {
  return memory;
}

export function rememberTaste(offerId: number, action: RememberedTaste) {
  memory = { ...memory, [offerId]: action };
  emit();
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    /* private mode / quota */
  }
}

export function subscribeTasteMemory(
  listener: (map: Record<number, RememberedTaste>) => void,
): () => void {
  listeners.add(listener);
  listener(memory);
  if (!hydrateStarted) {
    hydrateStarted = true;
    const stored = readStorage();
    memory = { ...stored, ...memory };
    emit();
  }
  return () => {
    listeners.delete(listener);
  };
}

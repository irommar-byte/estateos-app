import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DiscoveryTasteAction } from '../../services/discoveryService';

const KEY = '@estateos_discovery_taste_v1';

export type RememberedTaste = Exclude<DiscoveryTasteAction, 'OPEN'>;

let memory: Record<number, RememberedTaste> = {};
const listeners = new Set<(map: Record<number, RememberedTaste>) => void>();
let hydrateStarted = false;

function emit() {
  listeners.forEach((listener) => listener(memory));
}

function isTaste(value: unknown): value is RememberedTaste {
  return value === 'LIKE' || value === 'DISLIKE' || value === 'SERIOUS';
}

export function peekTasteMemory(): Record<number, RememberedTaste> {
  return memory;
}

export function rememberTaste(offerId: number, action: RememberedTaste) {
  memory = { ...memory, [offerId]: action };
  emit();
  void AsyncStorage.setItem(KEY, JSON.stringify(memory)).catch(() => undefined);
}

export function subscribeTasteMemory(
  listener: (map: Record<number, RememberedTaste>) => void,
): () => void {
  listeners.add(listener);
  listener(memory);
  if (!hydrateStarted) {
    hydrateStarted = true;
    void AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          const next: Record<number, RememberedTaste> = { ...memory };
          for (const [key, value] of Object.entries(parsed)) {
            const id = Number(key);
            if (!Number.isFinite(id) || !isTaste(value) || next[id]) continue;
            next[id] = value;
          }
          memory = next;
          emit();
        } catch {
          /* ignore corrupt cache */
        }
      })
      .catch(() => undefined);
  }
  return () => {
    listeners.delete(listener);
  };
}

/** Magical iPhone-style typing reveal into a controlled text field. */

export type TypewriterController = {
  cancel: () => void;
};

export function typewriterReveal(
  fullText: string,
  onUpdate: (partial: string) => void,
  options?: {
    onDone?: () => void;
    /** chars per tick */
    chunk?: number;
    /** ms between ticks */
    intervalMs?: number;
  },
): TypewriterController {
  const text = String(fullText || "");
  const chunk = Math.max(1, options?.chunk ?? 3);
  const intervalMs = Math.max(8, options?.intervalMs ?? 16);
  let i = 0;
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const tick = () => {
    if (cancelled) return;
    i = Math.min(text.length, i + chunk);
    onUpdate(text.slice(0, i));
    if (i >= text.length) {
      options?.onDone?.();
      return;
    }
    // Slightly slower near the end for a “thinking” feel
    const progress = i / Math.max(1, text.length);
    const delay = progress > 0.85 ? intervalMs + 10 : intervalMs;
    timer = setTimeout(tick, delay);
  };

  onUpdate("");
  timer = setTimeout(tick, 40);

  return {
    cancel: () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    },
  };
}

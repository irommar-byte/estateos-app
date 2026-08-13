/**
 * Global EstateOS button system — Apple-inspired, high contrast, light + dark.
 *
 * Use `eosBtn("primary")` on <button>/<a>/<Link>, or <EosButton variant="primary" />.
 *
 * DO NOT invent one-off CTA recipes like:
 *   bg-[#141416] … dark:bg-white dark:text-black
 *   bg-white/60 … text-[#141416] without dark pair
 *   hover:bg-[var(--eos-accent)] on soft pills (CTA shield used to match this and force black ink)
 *
 * Variants:
 * - primary   — filled contrast (black on light / white on dark)
 * - secondary — glass outline (readable on both themes)
 * - home      — EstateOS™Home solid emerald
 * - car       — EstateOS™Car solid sky
 * - call      — solid green CTA for phone
 * - promote   — amber elevate
 * - danger    — solid rose destructive
 * - ghost     — quiet text/border
 * - soft      — tinted surface (secondary actions)
 */

export type EosBtnVariant =
  | "primary"
  | "secondary"
  | "home"
  | "car"
  | "call"
  | "promote"
  | "danger"
  | "ghost"
  | "soft";

export type EosBtnSize = "sm" | "md" | "lg";

const SIZE: Record<EosBtnSize, string> = {
  sm: "eos-btn--sm",
  md: "",
  lg: "eos-btn--lg",
};

export function eosBtn(
  variant: EosBtnVariant = "primary",
  opts?: { size?: EosBtnSize; block?: boolean; className?: string },
): string {
  const parts = ["eos-btn", `eos-btn--${variant}`];
  const size = opts?.size || "md";
  if (SIZE[size]) parts.push(SIZE[size]);
  if (opts?.block) parts.push("eos-btn--block");
  if (opts?.className) parts.push(opts.className);
  return parts.filter(Boolean).join(" ");
}

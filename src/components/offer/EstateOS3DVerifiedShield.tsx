"use client";

import { motion } from "framer-motion";
import { ShieldCheck, Sparkles } from "lucide-react";

export type EstateOS3DShieldSize = "xs" | "sm" | "md" | "lg" | "hero";

type Props = {
  label?: string;
  sublabel?: string;
  size?: EstateOS3DShieldSize;
  /** Pełna animacja pochylenia 3D — wyłącz na listach gęstych */
  tilt?: boolean;
  /** Aktywny (zweryfikowany) — zielony i połysk; nieaktywny — szary, bez animacji */
  active?: boolean;
  /** Etykieta pod tarczą */
  showLabel?: boolean;
  className?: string;
};

const SIZE: Record<
  EstateOS3DShieldSize,
  { shell: string; icon: number; label: string; sub: string; ring: string }
> = {
  xs: { shell: "h-9 w-9", icon: 16, label: "text-[8px]", sub: "text-[7px]", ring: "inset-0" },
  sm: { shell: "h-11 w-11", icon: 20, label: "text-[9px]", sub: "text-[8px]", ring: "inset-0" },
  md: { shell: "h-16 w-16", icon: 28, label: "text-[10px]", sub: "text-[9px]", ring: "-inset-0.5" },
  lg: { shell: "h-24 w-24", icon: 40, label: "text-xs", sub: "text-[10px]", ring: "-inset-1" },
  hero: { shell: "h-32 w-32 sm:h-36 sm:w-36", icon: 52, label: "text-sm", sub: "text-[11px]", ring: "-inset-1.5" },
};

export default function EstateOS3DVerifiedShield({
  label = "ZWERYFIKOWANE",
  sublabel,
  size = "md",
  tilt = true,
  active = true,
  showLabel = true,
  className = "",
}: Props) {
  const s = SIZE[size];
  const displayLabel = String(label || (active ? "ZWERYFIKOWANE" : "NIEZWERYFIKOWANE")).toUpperCase();

  const shellClass = active
    ? "border-emerald-300/50 bg-gradient-to-br from-emerald-300 via-emerald-500 to-emerald-800 shadow-[0_12px_40px_rgba(16,185,129,0.45),inset_0_2px_0_rgba(255,255,255,0.45),inset_0_-8px_16px_rgba(6,78,59,0.55)]"
    : "border-zinc-500/35 bg-gradient-to-br from-zinc-600 via-zinc-700 to-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]";

  return (
    <div className={`inline-flex flex-col items-center gap-2.5 ${className}`}>
      <motion.div
        className="relative [perspective:900px]"
        animate={active && tilt ? { rotateY: [0, 10, 0, -10, 0], rotateX: [0, -4, 0, 4, 0] } : undefined}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className={`relative ${s.shell} [transform-style:preserve-3d]`} style={{ transform: "translateZ(0)" }}>
          {active ? (
            <motion.div
              className="absolute -inset-3 rounded-[2rem] bg-emerald-400/25 blur-2xl"
              animate={{ opacity: [0.35, 0.65, 0.35], scale: [0.92, 1.05, 0.92] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
              aria-hidden
            />
          ) : null}

          <div
            className={`relative flex h-full w-full items-center justify-center overflow-hidden rounded-[1.35rem] border ${shellClass} ${s.ring}`}
          >
            {active ? (
              <>
                <motion.div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/0 via-white/45 to-white/0"
                  animate={{ x: ["-120%", "120%"] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", repeatDelay: 1.2 }}
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute inset-0 rounded-[1.35rem] bg-gradient-to-b from-transparent via-transparent to-emerald-950/40"
                  aria-hidden
                />
              </>
            ) : (
              <div
                className="pointer-events-none absolute inset-0 rounded-[1.35rem] bg-gradient-to-b from-white/10 via-transparent to-black/30"
                aria-hidden
              />
            )}

            <div className="relative z-10 flex items-center justify-center drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
              <ShieldCheck
                size={s.icon}
                className={active ? "text-white" : "text-zinc-300/90"}
                strokeWidth={2.2}
              />
            </div>

            {active ? (
              <motion.span
                className="absolute right-1.5 top-1.5 text-emerald-100/90"
                animate={{ opacity: [0.4, 1, 0.4], rotate: [0, 15, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                aria-hidden
              >
                <Sparkles size={size === "hero" ? 14 : 10} />
              </motion.span>
            ) : null}
          </div>
        </div>
      </motion.div>

      {showLabel ? (
        <div className="max-w-[14rem] text-center">
          <p
            className={`font-semibold uppercase tracking-[0.14em] ${s.label} ${
              active ? "text-emerald-300" : "text-zinc-400"
            }`}
          >
            {displayLabel}
          </p>
          {sublabel ? (
            <p className={`mt-1 font-medium leading-snug text-zinc-500 ${s.sub}`}>{sublabel}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

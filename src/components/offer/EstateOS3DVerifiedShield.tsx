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
  label = "Zweryfikowane KW",
  sublabel,
  size = "md",
  tilt = true,
  showLabel = true,
  className = "",
}: Props) {
  const s = SIZE[size];

  return (
    <div className={`inline-flex flex-col items-center gap-2.5 ${className}`}>
      <motion.div
        className="relative [perspective:900px]"
        animate={
          tilt
            ? { rotateY: [0, 10, 0, -10, 0], rotateX: [0, -4, 0, 4, 0] }
            : undefined
        }
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      >
        <div
          className={`relative ${s.shell} [transform-style:preserve-3d]`}
          style={{ transform: "translateZ(0)" }}
        >
          {/* Poświata */}
          <motion.div
            className="absolute -inset-3 rounded-[2rem] bg-emerald-400/25 blur-2xl"
            animate={{ opacity: [0.35, 0.65, 0.35], scale: [0.92, 1.05, 0.92] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden
          />

          {/* Tarcza 3D */}
          <div
            className={`relative flex h-full w-full items-center justify-center overflow-hidden rounded-[1.35rem] border border-emerald-300/50 bg-gradient-to-br from-emerald-300 via-emerald-500 to-emerald-800 shadow-[0_12px_40px_rgba(16,185,129,0.45),inset_0_2px_0_rgba(255,255,255,0.45),inset_0_-8px_16px_rgba(6,78,59,0.55)] ${s.ring}`}
          >
            {/* Połysk */}
            <motion.div
              className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-white/0 via-white/45 to-white/0"
              animate={{ x: ["-120%", "120%"] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", repeatDelay: 1.2 }}
              aria-hidden
            />

            {/* Głębia — ciemniejszy brzeg */}
            <div
              className="pointer-events-none absolute inset-0 rounded-[1.35rem] bg-gradient-to-b from-transparent via-transparent to-emerald-950/40"
              aria-hidden
            />

            {/* Ikona */}
            <motion.div
              className="relative z-10 flex items-center justify-center drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
            >
              <ShieldCheck size={s.icon} className="text-white" strokeWidth={2.2} />
            </motion.div>

            {/* Iskierka */}
            <motion.span
              className="absolute right-1.5 top-1.5 text-emerald-100/90"
              animate={{ opacity: [0.4, 1, 0.4], rotate: [0, 15, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              aria-hidden
            >
              <Sparkles size={size === "hero" ? 14 : 10} />
            </motion.span>
          </div>
        </div>
      </motion.div>

      {showLabel ? (
        <div className="text-center max-w-[14rem]">
          <motion.p
            className={`font-black uppercase tracking-[0.16em] text-emerald-300 ${s.label}`}
            animate={{ opacity: [0.78, 1, 0.78] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          >
            {label}
          </motion.p>
          {sublabel ? (
            <p className={`mt-1 font-medium leading-snug text-zinc-400 ${s.sub}`}>{sublabel}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

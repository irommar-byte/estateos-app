"use client";

import { motion, useReducedMotion } from "framer-motion";

/** Brand pill inspired by Dynamic Island — replaces the analog clock widget. */
export default function EosDynamicIslandBadge() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0.2 : 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative z-50 flex items-center justify-center"
      aria-hidden
    >
      <div className="relative flex h-[42px] min-w-[100px] items-center justify-center gap-2 rounded-full border border-white/10 bg-[#050505]/80 px-5 shadow-[0_8px_24px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-3xl">
        {!reduceMotion && (
          <motion.span
            className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-emerald-500/10 to-transparent"
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        <motion.span
          className="relative h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.9)]"
          animate={reduceMotion ? undefined : { opacity: [1, 0.4, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <span className="relative text-[12px] font-black uppercase tracking-widest">
          <span className="text-emerald-400">E</span>
          <span className="text-white">OS</span>
        </span>
      </div>
    </motion.div>
  );
}

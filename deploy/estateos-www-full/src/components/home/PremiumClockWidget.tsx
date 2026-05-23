"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default function PremiumClockWidget() {
  const [now, setNow] = useState<Date | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => {
      clearInterval(t);
      mq.removeEventListener("change", sync);
    };
  }, []);

  if (!now) {
    return (
      <motion.div
        aria-hidden
        className="h-[140px] w-[140px] rounded-full border border-white/10 bg-black/40"
      />
    );
  }

  const h = now.getHours() % 12;
  const m = now.getMinutes();
  const s = now.getSeconds();
  const hourDeg = h * 30 + m * 0.5;
  const minuteDeg = m * 6 + s * 0.1;
  const secondDeg = s * 6;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: reduceMotion ? 0.2 : 0.9, ease: [0.16, 1, 0.3, 1] }}
      className="relative mx-auto flex h-[140px] w-[140px] shrink-0 items-center justify-center sm:mx-0 sm:h-[168px] sm:w-[168px]"
      aria-label={`EstateOS timepiece ${pad(now.getHours())}:${pad(now.getMinutes())}`}
    >
      {!reduceMotion && (
        <motion.div
          aria-hidden
          className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.22),transparent_68%)] blur-md"
          animate={{ opacity: [0.35, 0.65, 0.4] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <motion.div
        aria-hidden
        className="absolute inset-[6%] rounded-full border border-emerald-500/25 shadow-[inset_0_0_40px_rgba(16,185,129,0.12)]"
        animate={reduceMotion ? undefined : { rotate: 360 }}
        transition={reduceMotion ? undefined : { duration: 90, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        aria-hidden
        className="absolute inset-[14%] rounded-full border border-white/10 bg-gradient-to-br from-zinc-900 via-black to-zinc-950"
      />
      <div className="absolute inset-[22%] rounded-full border border-white/[0.06]" />
      {[...Array(12)].map((_, i) => (
        <span
          key={i}
          aria-hidden
          className="absolute left-1/2 top-[10%] h-[8%] w-px origin-bottom -translate-x-1/2 bg-white/25"
          style={{ transform: `translateX(-50%) rotate(${i * 30}deg)` }}
        />
      ))}
      <div
        className="absolute left-1/2 top-1/2 z-10 h-[28%] w-0.5 origin-bottom -translate-x-1/2 rounded-full bg-gradient-to-t from-emerald-600 to-emerald-300"
        style={{ transform: `translateX(-50%) rotate(${hourDeg}deg)` }}
      />
      <motion.div
        className="absolute left-1/2 top-1/2 z-20 h-[38%] w-px origin-bottom -translate-x-1/2 rounded-full bg-white/90"
        style={{ transform: `translateX(-50%) rotate(${minuteDeg}deg)` }}
        animate={reduceMotion ? undefined : { opacity: [0.85, 1, 0.9] }}
        transition={reduceMotion ? undefined : { duration: 2, repeat: Infinity }}
      />
      <motion.div
        className="absolute left-1/2 top-[38%] z-30 h-[32%] w-[2px] origin-bottom -translate-x-1/2 rounded-full bg-emerald-400"
        style={{ transform: `translateX(-50%) rotate(${secondDeg}deg)` }}
      />
      <motion.div
        aria-hidden
        className="absolute left-1/2 top-1/2 z-40 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.8)]"
      />
      <p className="absolute -bottom-7 left-1/2 w-max -translate-x-1/2 text-[9px] font-bold uppercase tracking-[0.28em] text-emerald-400/80">
        EOS Time
      </p>
    </motion.div>
  );
}

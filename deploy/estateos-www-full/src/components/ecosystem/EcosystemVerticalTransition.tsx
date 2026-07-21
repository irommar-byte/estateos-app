"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Car, Home } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEcosystem, type EcosystemVertical } from "@/contexts/EcosystemContext";

const TRANSITION_MS = 780;

export default function EcosystemVerticalTransition() {
  const router = useRouter();
  const { pendingSwitch, setVertical, clearVerticalSwitch } = useEcosystem();
  const [active, setActive] = useState<{
    from: EcosystemVertical;
    to: EcosystemVertical;
    href: string;
  } | null>(null);

  useEffect(() => {
    if (!pendingSwitch) return;
    setActive(pendingSwitch);

    const mid = window.setTimeout(() => {
      setVertical(pendingSwitch.to);
      router.push(pendingSwitch.href);
    }, 320);

    const done = window.setTimeout(() => {
      clearVerticalSwitch();
      setActive(null);
    }, TRANSITION_MS);

    return () => {
      window.clearTimeout(mid);
      window.clearTimeout(done);
    };
  }, [pendingSwitch, router, setVertical, clearVerticalSwitch]);

  const to = active?.to ?? "home";
  const isCar = to === "car";

  return (
    <AnimatePresence>
      {active ? (
        <motion.div
          key={`${active.from}-${active.to}-${active.href}`}
          className="pointer-events-none fixed inset-0 z-[180] overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          aria-hidden
        >
          <motion.div
            className={`absolute inset-0 ${
              isCar
                ? "bg-gradient-to-br from-sky-500 via-cyan-500 to-blue-700"
                : "bg-gradient-to-br from-emerald-400 via-teal-500 to-emerald-800"
            }`}
            initial={{ clipPath: "circle(0% at 50% 8%)" }}
            animate={{ clipPath: "circle(160% at 50% 8%)" }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          />
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-white"
            initial={{ opacity: 0, scale: 0.86, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.06, y: -12 }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
          >
            <motion.div
              className="flex size-20 items-center justify-center rounded-[1.75rem] bg-white/15 shadow-[0_20px_60px_rgba(0,0,0,0.25)] ring-1 ring-white/30 backdrop-blur-md"
              animate={{ rotate: [0, isCar ? 8 : -8, 0], scale: [1, 1.08, 1] }}
              transition={{ duration: 0.7, ease: "easeInOut" }}
            >
              {isCar ? <Car className="size-10" strokeWidth={1.75} /> : <Home className="size-10" strokeWidth={1.75} />}
            </motion.div>
            <div className="text-center">
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-white/75">EstateOS™</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">
                {isCar ? "Car" : "Home"}
              </p>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

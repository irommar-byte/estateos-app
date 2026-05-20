"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import EosDynamicIslandBadge from "@/components/home/EosDynamicIslandBadge";

export default function CinematicLoader() {
  const reduceMotion = useReducedMotion();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (reduceMotion) return;
    if (sessionStorage.getItem("eos_cinematic_loaded") === "1") return;

    setIsLoading(true);
    sessionStorage.setItem("eos_cinematic_loaded", "1");
    const timer = window.setTimeout(() => setIsLoading(false), 800);

    return () => window.clearTimeout(timer);
  }, [reduceMotion]);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          key="loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04, filter: "blur(10px)" }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#050505]"
        >
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          >
            <EosDynamicIslandBadge />
          </motion.div>
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 220, opacity: 1 }}
            transition={{ duration: 0.8, ease: "easeInOut", delay: 0.12 }}
            className="mt-8 h-px bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

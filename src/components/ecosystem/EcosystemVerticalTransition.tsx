"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Car, Cog, Home } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEcosystem, type EcosystemVertical } from "@/contexts/EcosystemContext";
import { useLocale } from "@/contexts/LocaleContext";

/** Gear spin (~1s) then icon zoom to fill screen. */
const GEAR_MS = 1000;
const ZOOM_MS = 520;
const TOTAL_MS = GEAR_MS + ZOOM_MS + 120;

export default function EcosystemVerticalTransition() {
  const router = useRouter();
  const { locale } = useLocale();
  const { pendingSwitch, setVertical, clearVerticalSwitch } = useEcosystem();
  const [active, setActive] = useState<{
    from: EcosystemVertical;
    to: EcosystemVertical;
    href: string;
  } | null>(null);
  const [phase, setPhase] = useState<"gears" | "zoom">("gears");

  useEffect(() => {
    if (!pendingSwitch) return;
    setActive(pendingSwitch);
    setPhase("gears");

    const zoomAt = window.setTimeout(() => {
      setPhase("zoom");
      setVertical(pendingSwitch.to);
      router.push(pendingSwitch.href);
    }, GEAR_MS);

    const done = window.setTimeout(() => {
      clearVerticalSwitch();
      setActive(null);
      setPhase("gears");
    }, TOTAL_MS);

    return () => {
      window.clearTimeout(zoomAt);
      window.clearTimeout(done);
    };
  }, [pendingSwitch, router, setVertical, clearVerticalSwitch]);

  const to = active?.to ?? "home";
  const isCar = to === "car";
  const switchingLabel =
    locale === "en"
      ? `Switching to EstateOS™${isCar ? "Car" : "Home"} mode`
      : locale === "uk"
        ? `Перемикаю на режим EstateOS™${isCar ? "Car" : "Home"}`
        : `Przełączam na tryb EstateOS™${isCar ? "Car" : "Home"}`;

  return (
    <AnimatePresence>
      {active ? (
        <motion.div
          key={`${active.from}-${active.to}-${active.href}`}
          className="pointer-events-none fixed inset-0 z-[180] overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.2 } }}
          transition={{ duration: 0.2 }}
          aria-hidden
        >
          <motion.div
            className={`absolute inset-0 ${
              isCar
                ? "bg-gradient-to-br from-sky-500 via-cyan-500 to-blue-800"
                : "bg-gradient-to-br from-emerald-400 via-teal-500 to-emerald-900"
            }`}
            initial={{ opacity: 0.92 }}
            animate={{ opacity: 1 }}
          />

          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-white">
            <AnimatePresence mode="wait">
              {phase === "gears" ? (
                <motion.div
                  key="gears"
                  className="flex flex-col items-center gap-6"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={{ duration: 0.22 }}
                >
                  <div className="relative flex size-28 items-center justify-center">
                    <motion.div
                      className="absolute left-2 top-3 text-white/85"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, ease: "linear", repeat: Infinity }}
                    >
                      <Cog className="size-14" strokeWidth={1.5} />
                    </motion.div>
                    <motion.div
                      className="absolute bottom-2 right-1 text-white/70"
                      animate={{ rotate: -360 }}
                      transition={{ duration: 1.15, ease: "linear", repeat: Infinity }}
                    >
                      <Cog className="size-10" strokeWidth={1.5} />
                    </motion.div>
                  </div>
                  <div className="max-w-sm text-center">
                    <p className="text-[11px] font-black uppercase tracking-[0.28em] text-white/70">EstateOS™</p>
                    <p className="mt-3 text-lg font-semibold leading-snug tracking-tight sm:text-xl">
                      {switchingLabel}
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="zoom"
                  className="flex flex-col items-center"
                  initial={{ opacity: 1, scale: 0.35 }}
                  animate={{ opacity: 1, scale: 18 }}
                  transition={{ duration: ZOOM_MS / 1000, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div
                    className={`flex size-24 items-center justify-center rounded-[1.75rem] ${
                      isCar ? "bg-sky-300/30" : "bg-emerald-300/30"
                    } ring-1 ring-white/40`}
                  >
                    {isCar ? (
                      <Car className="size-12 text-white" strokeWidth={1.6} />
                    ) : (
                      <Home className="size-12 text-white" strokeWidth={1.6} />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

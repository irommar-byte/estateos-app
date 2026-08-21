"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Car, Home } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEcosystem, type EcosystemVertical } from "@/contexts/EcosystemContext";
import { useLocale } from "@/contexts/LocaleContext";

const HOLD_MS = 720;
const FADE_MS = 380;
const TOTAL_MS = HOLD_MS + FADE_MS;
const ease = [0.16, 1, 0.3, 1] as const;

export default function EcosystemVerticalTransition() {
  const router = useRouter();
  const pathname = usePathname() || "";
  const { locale } = useLocale();
  const reduceMotion = useReducedMotion();
  const { pendingSwitch, setVertical, clearVerticalSwitch } = useEcosystem();
  const [active, setActive] = useState<{
    from: EcosystemVertical;
    to: EcosystemVertical;
    href: string;
    fromHome: boolean;
  } | null>(null);

  useEffect(() => {
    if (!pendingSwitch) return;
    const fromHome = pathname === "/" || pathname === "";
    setActive({ ...pendingSwitch, fromHome });

    const hold = reduceMotion ? 180 : fromHome ? HOLD_MS * 0.85 : HOLD_MS;
    const total = reduceMotion ? 320 : fromHome ? HOLD_MS + FADE_MS * 0.9 : TOTAL_MS;

    const navigateAt = window.setTimeout(() => {
      setVertical(pendingSwitch.to);
      router.push(pendingSwitch.href);
    }, hold * 0.55);

    const done = window.setTimeout(() => {
      clearVerticalSwitch();
      setActive(null);
    }, total);

    return () => {
      window.clearTimeout(navigateAt);
      window.clearTimeout(done);
    };
  }, [pendingSwitch, router, setVertical, clearVerticalSwitch, pathname, reduceMotion]);

  const to = active?.to ?? "home";
  const isCar = to === "car";
  const from = active?.from ?? "home";
  const goingRight = from === "home" && to === "car";

  const switchingLabel =
    locale === "en"
      ? `Entering EstateOS™ ${isCar ? "Car" : "Home"}`
      : locale === "uk"
        ? `EstateOS™ ${isCar ? "Car" : "Home"}`
        : `Przechodzę do EstateOS™ ${isCar ? "Car" : "Home"}`;

  return (
    <AnimatePresence>
      {active ? (
        <motion.div
          key={`${active.from}-${active.to}-${active.href}`}
          className="eos-lux-wipe pointer-events-none fixed inset-0 z-[180] overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: reduceMotion ? 0.12 : 0.32, ease } }}
          transition={{ duration: reduceMotion ? 0.1 : 0.28, ease }}
          aria-hidden
        >
          {/* Depth layers */}
          <motion.div
            className={`absolute inset-0 ${
              isCar
                ? "bg-gradient-to-br from-[#0b1220] via-[#0c4a6e] to-[#082f49]"
                : "bg-gradient-to-br from-[#0f1412] via-[#064e3b] to-[#022c22]"
            }`}
            initial={{ scale: 1.04 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.9, ease }}
          />

          <motion.div
            className="absolute inset-0"
            style={{
              background: isCar
                ? "radial-gradient(ellipse at 70% 40%, rgba(125,211,252,0.28), transparent 55%)"
                : "radial-gradient(ellipse at 30% 40%, rgba(110,231,183,0.26), transparent 55%)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.55 }}
          />

          <motion.div
            className="absolute inset-y-0 w-[58%] bg-gradient-to-r from-black/35 via-black/10 to-transparent"
            initial={{ x: goingRight ? "-8%" : "8%", opacity: 0.4 }}
            animate={{ x: goingRight ? "42%" : "-42%", opacity: 0.15 }}
            transition={{ duration: reduceMotion ? 0.2 : 0.95, ease }}
          />

          {/* Gold hairline sweep */}
          {!reduceMotion ? (
            <motion.div
              className="absolute inset-y-[18%] w-px bg-gradient-to-b from-transparent via-[#E8D5A3] to-transparent shadow-[0_0_24px_rgba(232,213,163,0.55)]"
              initial={{ left: goingRight ? "8%" : "92%", opacity: 0 }}
              animate={{ left: goingRight ? "88%" : "12%", opacity: [0, 1, 0.4] }}
              transition={{ duration: 0.95, ease }}
            />
          ) : null}

          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_20%,rgba(0,0,0,0.45)_100%)]" />

          <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
            <motion.div
              className="flex flex-col items-center gap-5"
              initial={{ opacity: 0, y: 18, filter: reduceMotion ? "none" : "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: reduceMotion ? 0.15 : 0.55, ease, delay: 0.05 }}
            >
              <motion.div
                className={`eos-lux-wipe__medal relative flex size-[5.5rem] items-center justify-center rounded-[1.85rem] ${
                  isCar ? "eos-lux-wipe__medal--car" : "eos-lux-wipe__medal--home"
                }`}
                initial={{ scale: 0.82, rotate: goingRight ? -6 : 6 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 22, mass: 0.9 }}
              >
                <span className="eos-lux-wipe__medal-ring" />
                {isCar ? (
                  <Car className="relative z-10 size-11 text-white drop-shadow-[0_8px_20px_rgba(0,0,0,0.45)]" strokeWidth={1.45} />
                ) : (
                  <Home className="relative z-10 size-11 text-white drop-shadow-[0_8px_20px_rgba(0,0,0,0.45)]" strokeWidth={1.45} />
                )}
              </motion.div>

              <div className="text-center">
                <motion.p
                  className="text-[10px] font-black uppercase tracking-[0.36em] text-[#E8D5A3]/90"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12, duration: 0.4, ease }}
                >
                  EstateOS™
                </motion.p>
                <motion.p
                  className="mt-2.5 text-xl font-semibold tracking-tight text-white sm:text-2xl"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.18, duration: 0.45, ease }}
                >
                  {switchingLabel}
                </motion.p>
                <motion.div
                  className="mx-auto mt-4 h-px w-16 bg-gradient-to-r from-transparent via-[#E8D5A3]/80 to-transparent"
                  initial={{ scaleX: 0, opacity: 0 }}
                  animate={{ scaleX: 1, opacity: 1 }}
                  transition={{ delay: 0.28, duration: 0.45, ease }}
                />
              </div>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

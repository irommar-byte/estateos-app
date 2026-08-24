"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ReactLenis } from "lenis/react";

/**
 * Lenis tylko na desktop (fine pointer) — na touch native scroll jest płynniejszy
 * i nie walczy z layoutem / fixed nav / mapą.
 */
export default function SmoothScroll({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<"native" | "lenis">("native");

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const narrow = window.matchMedia("(max-width: 767px)");

    const sync = () => {
      const useLenis = fine.matches && !reduce.matches && !narrow.matches;
      setMode(useLenis ? "lenis" : "native");
    };

    sync();
    fine.addEventListener("change", sync);
    reduce.addEventListener("change", sync);
    narrow.addEventListener("change", sync);
    return () => {
      fine.removeEventListener("change", sync);
      reduce.removeEventListener("change", sync);
      narrow.removeEventListener("change", sync);
    };
  }, []);

  if (mode !== "lenis") return <>{children}</>;

  return (
    <ReactLenis
      root
      options={{
        lerp: 0.12,
        duration: 1.05,
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 1.4,
        syncTouch: false,
      }}
    >
      {children}
    </ReactLenis>
  );
}

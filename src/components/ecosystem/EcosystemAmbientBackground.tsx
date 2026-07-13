"use client";

import { usePathname } from "next/navigation";
import CatalogBrandHeroMotif from "@/components/catalog/CatalogBrandHeroMotif";
import { useEcosystem } from "@/contexts/EcosystemContext";

export default function EcosystemAmbientBackground() {
  const pathname = usePathname() || "";
  const { vertical } = useEcosystem();

  const isCarRoute = pathname.startsWith("/cars");
  const variant = isCarRoute || vertical === "car" ? "car" : "home";

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-[var(--eos-nav-height)] z-0 h-[min(52vh,520px)] overflow-hidden"
    >
      <div
        className={`absolute inset-0 ${
          variant === "car"
            ? "bg-gradient-to-br from-sky-500/[0.04] via-transparent to-cyan-500/[0.03]"
            : "bg-gradient-to-br from-emerald-500/[0.035] via-transparent to-emerald-500/[0.02]"
        }`}
      />
      <CatalogBrandHeroMotif
        variant={variant}
        className={`absolute -right-[8%] top-0 h-full w-auto max-w-none opacity-[0.055] sm:opacity-[0.07] ${
          variant === "car" ? "translate-y-2" : "translate-y-4"
        }`}
      />
    </div>
  );
}

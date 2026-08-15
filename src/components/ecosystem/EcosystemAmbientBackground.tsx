"use client";

import { usePathname } from "next/navigation";
import { catalogBrandPhoto } from "@/components/catalog/CatalogBrandHeroMotif";
import { useEcosystem } from "@/contexts/EcosystemContext";

export default function EcosystemAmbientBackground() {
  const pathname = usePathname() || "";
  const { vertical } = useEcosystem();

  const isCarRoute = pathname.startsWith("/cars");
  const variant = isCarRoute || vertical === "car" ? "car" : "home";
  const photo = catalogBrandPhoto(variant);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-[var(--eos-nav-height)] z-0 h-[min(58vh,560px)] overflow-hidden"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo}
        alt=""
        className="eos-ambient-photo absolute inset-0 h-full w-full object-cover object-[center_35%] opacity-[0.22] sm:opacity-[0.26]"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-[var(--eos-bg)]/55 to-[var(--eos-bg)]" />
    </div>
  );
}

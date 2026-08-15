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
      className="eos-ambient-wash pointer-events-none fixed inset-x-0 top-[var(--eos-nav-height)] z-0 h-[min(62vh,620px)] overflow-hidden"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo}
        alt=""
        className="eos-ambient-photo absolute inset-0 h-full w-full object-cover object-[center_32%]"
      />
      <div className="eos-ambient-fade absolute inset-0" />
    </div>
  );
}

import type { ReactNode } from "react";
import CatalogBrandHeroMotif from "@/components/catalog/CatalogBrandHeroMotif";

type CatalogBrandHeroProps = {
  brand: "home" | "car";
  title: string;
  description: string;
  stats?: string | null;
  accent?: "sale" | "rent";
  children?: ReactNode;
};

export default function CatalogBrandHero({
  brand,
  title,
  description,
  stats,
  accent = "sale",
  children,
}: CatalogBrandHeroProps) {
  return (
    <header className="relative mb-8 overflow-hidden rounded-3xl border border-white/10 min-h-[220px] shadow-[0_28px_80px_rgba(0,0,0,0.28)]">
      <CatalogBrandHeroMotif
        variant={brand}
        accent={accent}
        className="absolute inset-0 h-full w-full"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/78 via-black/52 to-black/22" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" />

      <div className="relative z-10 max-w-3xl p-6 sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-white/70">
          {brand === "car" ? "EstateOS™Car" : "EstateOS™Home"}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">{title}</h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/78 sm:text-base">{description}</p>
        {children ? <div className="relative z-10">{children}</div> : null}
        {stats ? (
          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">{stats}</p>
        ) : null}
      </div>
    </header>
  );
}

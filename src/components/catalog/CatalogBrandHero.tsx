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

const brandStyles = {
  home: {
    border: "border-emerald-400/20",
    shadow: "shadow-[0_22px_70px_rgba(16,185,129,0.08)]",
    blobA: "bg-emerald-500/10",
    blobB: "bg-emerald-500/6",
    label: "text-emerald-400",
    stats: "text-emerald-700 dark:text-emerald-300",
  },
  car: {
    border: "border-sky-400/20",
    shadow: "shadow-[0_22px_70px_rgba(14,165,233,0.08)]",
    blobA: "bg-sky-500/10",
    blobB: "bg-cyan-500/8",
    label: "text-sky-400",
    stats: "text-sky-700 dark:text-sky-300",
  },
} as const;

export default function CatalogBrandHero({
  brand,
  title,
  description,
  stats,
  accent = "sale",
  children,
}: CatalogBrandHeroProps) {
  const styles = brandStyles[brand];
  const homeAccent = brand === "home" && accent === "rent";

  return (
    <header
      className={`relative mb-8 overflow-hidden rounded-3xl border bg-[var(--eos-card)] p-6 sm:p-8 ${styles.border} ${styles.shadow}`}
    >
      <div className={`pointer-events-none absolute -right-16 -top-16 size-56 rounded-full blur-3xl ${styles.blobA}`} />
      <div className={`pointer-events-none absolute -bottom-20 -left-12 size-44 rounded-full blur-3xl ${styles.blobB}`} />

      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[min(48%,440px)] sm:block">
        <div className="absolute inset-0 bg-gradient-to-l from-transparent via-[var(--eos-card)]/25 to-[var(--eos-card)]" />
        <CatalogBrandHeroMotif
          variant={brand}
          accent={accent}
          className={`absolute -right-6 top-1/2 h-[118%] w-auto max-w-none -translate-y-1/2 ${
            homeAccent ? "opacity-[0.2] sm:opacity-[0.26]" : "opacity-[0.18] sm:opacity-[0.24]"
          }`}
        />
      </div>

      <div className="relative z-10 max-w-3xl">
        <p className={`text-xs font-black uppercase tracking-[0.22em] ${styles.label}`}>
          {brand === "car" ? "EstateOS™Car" : "EstateOS™Home"}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[var(--eos-muted)] sm:text-base">{description}</p>
        {children ? <div className="relative z-10">{children}</div> : null}
        {stats ? (
          <p className={`mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] ${styles.stats}`}>{stats}</p>
        ) : null}
      </div>

      <div className="pointer-events-none absolute bottom-4 right-4 sm:hidden">
        <CatalogBrandHeroMotif variant={brand} accent={accent} className="h-24 w-auto opacity-[0.14]" />
      </div>
    </header>
  );
}

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
    <header className={`eos-catalog-hero eos-catalog-hero--${brand}`}>
      <div className="eos-catalog-hero__copy">
        <p className="eos-catalog-hero__eyebrow">
          {brand === "car" ? "EstateOS™ Car" : "EstateOS™ Home"}
        </p>
        <h1 className="eos-catalog-hero__title">{title}</h1>
        <p className="eos-catalog-hero__lead">{description}</p>
        {children ? <div className="eos-catalog-hero__actions">{children}</div> : null}
        {stats ? <p className="eos-catalog-hero__stats">{stats}</p> : null}
      </div>
      <div className="eos-catalog-hero__media" aria-hidden>
        <CatalogBrandHeroMotif
          variant={brand}
          accent={accent}
          className="eos-catalog-hero__photo"
        />
      </div>
    </header>
  );
}

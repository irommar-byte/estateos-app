import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

type Brand = "home" | "car";
type Accent = "sale" | "rent";

const primaryByBrand: Record<Brand, Record<Accent, string>> = {
  home: {
    sale:
      "bg-emerald-500 text-white shadow-[0_10px_28px_rgba(16,185,129,0.35)] hover:bg-emerald-400 hover:shadow-[0_14px_36px_rgba(16,185,129,0.45)] hover:-translate-y-0.5 active:translate-y-0 active:bg-emerald-600",
    rent:
      "bg-sky-500 text-white shadow-[0_10px_28px_rgba(14,165,233,0.35)] hover:bg-sky-400 hover:shadow-[0_14px_36px_rgba(14,165,233,0.45)] hover:-translate-y-0.5 active:translate-y-0 active:bg-sky-600",
  },
  car: {
    sale:
      "bg-sky-500 text-white shadow-[0_10px_28px_rgba(14,165,233,0.38)] hover:bg-sky-400 hover:shadow-[0_14px_36px_rgba(14,165,233,0.5)] hover:-translate-y-0.5 active:translate-y-0 active:bg-sky-600",
    rent:
      "bg-sky-500 text-white shadow-[0_10px_28px_rgba(14,165,233,0.38)] hover:bg-sky-400 hover:shadow-[0_14px_36px_rgba(14,165,233,0.5)] hover:-translate-y-0.5 active:translate-y-0 active:bg-sky-600",
  },
};

const basePrimary =
  "group inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-[13px] font-semibold tracking-[-0.01em] transition duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--eos-card)]";

const baseSecondary =
  "inline-flex items-center justify-center gap-2 rounded-2xl border border-[var(--eos-border)] bg-[var(--eos-bg)] px-4 py-3 text-[12px] font-semibold tracking-[-0.01em] text-[var(--eos-text)] transition duration-200 ease-out hover:border-[var(--eos-border-strong)] hover:bg-[var(--eos-bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eos-accent)]/45";

type CatalogHeroPrimaryLinkProps = {
  brand: Brand;
  accent?: Accent;
  href: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<typeof Link>, "href" | "className" | "children">;

export function CatalogHeroPrimaryLink({
  brand,
  accent = "sale",
  href,
  children,
  ...rest
}: CatalogHeroPrimaryLinkProps) {
  const ring =
    brand === "car" || accent === "rent"
      ? "focus-visible:ring-sky-400/60"
      : "focus-visible:ring-emerald-400/60";

  return (
    <Link
      href={href}
      className={`${basePrimary} ${primaryByBrand[brand][accent]} ${ring}`}
      {...rest}
    >
      {children}
    </Link>
  );
}

type CatalogHeroSecondaryLinkProps = {
  href: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<typeof Link>, "href" | "className" | "children">;

export function CatalogHeroSecondaryLink({ href, children, ...rest }: CatalogHeroSecondaryLinkProps) {
  return (
    <Link href={href} className={baseSecondary} {...rest}>
      {children}
    </Link>
  );
}

type CatalogHeroSecondaryButtonProps = {
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<"button">, "className" | "children">;

export function CatalogHeroSecondaryButton({ children, ...rest }: CatalogHeroSecondaryButtonProps) {
  return (
    <button type="button" className={baseSecondary} {...rest}>
      {children}
    </button>
  );
}

export function CatalogHeroActionRow({ children }: { children: ReactNode }) {
  return (
    <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      {children}
    </div>
  );
}

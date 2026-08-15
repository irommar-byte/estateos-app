type CatalogBrandHeroMotifProps = {
  variant: "home" | "car";
  accent?: "sale" | "rent";
  className?: string;
};

const PHOTOS = {
  homeSale:
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1800&q=72",
  homeRent:
    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1800&q=72",
  car: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1800&q=80",
} as const;

export function catalogBrandPhoto(variant: "home" | "car", accent: "sale" | "rent" = "sale") {
  if (variant === "car") return PHOTOS.car;
  return accent === "rent" ? PHOTOS.homeRent : PHOTOS.homeSale;
}

export default function CatalogBrandHeroMotif({
  variant,
  accent = "sale",
  className = "",
}: CatalogBrandHeroMotifProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={catalogBrandPhoto(variant, accent)}
      alt=""
      aria-hidden
      className={`object-cover ${className}`}
    />
  );
}

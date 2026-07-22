import type { Metadata } from "next";

/** Explicit OG image — child pages with own metadata do not inherit root opengraph-image. */
export const FREE_LISTING_OG_IMAGE = {
  url: "/wystaw-za-darmo/opengraph-image",
  width: 1200,
  height: 630,
  type: "image/png",
  alt: "EstateOS™ — wystaw mieszkanie, dom lub samochód za darmo",
} as const;

export const FREE_LISTING_HOME_OG_IMAGE = {
  url: "/wystaw-nieruchomosc-za-darmo/opengraph-image",
  width: 1200,
  height: 630,
  type: "image/png",
  alt: "EstateOS™Home — wystaw nieruchomość za darmo",
} as const;

export function freeListingOpenGraph(
  partial: NonNullable<Metadata["openGraph"]>,
  variant: "hub" | "home" = "hub",
): NonNullable<Metadata["openGraph"]> {
  return {
    ...partial,
    images: [variant === "home" ? FREE_LISTING_HOME_OG_IMAGE : FREE_LISTING_OG_IMAGE],
  };
}

export function freeListingTwitter(
  partial: NonNullable<Metadata["twitter"]>,
  variant: "hub" | "home" = "hub",
): NonNullable<Metadata["twitter"]> {
  const img = variant === "home" ? FREE_LISTING_HOME_OG_IMAGE : FREE_LISTING_OG_IMAGE;
  return {
    ...partial,
    card: "summary_large_image",
    images: [img.url],
  };
}

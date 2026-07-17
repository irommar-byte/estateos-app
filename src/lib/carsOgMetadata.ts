import type { Metadata } from "next";

/** Explicit OG image — parent file convention is not inherited by child pages with their own metadata. */
export const CARS_OG_IMAGE = {
  url: "/cars/opengraph-image",
  width: 1200,
  height: 630,
  type: "image/png",
  alt: "EstateOS™Car — zastrzeż VIN, kupujący sprawdzi historię i OC",
} as const;

export function carsOpenGraph(
  partial: NonNullable<Metadata["openGraph"]>,
): NonNullable<Metadata["openGraph"]> {
  return {
    ...partial,
    images: [CARS_OG_IMAGE],
  };
}

export function carsTwitter(
  partial: NonNullable<Metadata["twitter"]>,
): NonNullable<Metadata["twitter"]> {
  return {
    ...partial,
    card: "summary_large_image",
    images: [CARS_OG_IMAGE.url],
  };
}

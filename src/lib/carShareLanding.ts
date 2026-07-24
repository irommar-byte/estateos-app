import type { Metadata } from "next";
import { carImageSrc, formatCarPrice, formatMileage } from "@/lib/carsPresentation";
import { findCarById } from "@/lib/carsStorage";

function resolvePublicAppOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://estateos.pl").replace(
    /\/+$/,
    "",
  );
}

function absolutizeMediaUrl(url: string): string {
  const raw = String(url || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  const origin = resolvePublicAppOrigin();
  return raw.startsWith("/") ? `${origin}${raw}` : `${origin}/${raw}`;
}

function parseCarImages(car: { imageUrl?: string | null; images?: string | null }): string[] {
  const fromJson: string[] = [];
  const raw = String(car.images || "").trim();
  if (raw.startsWith("[")) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const abs = absolutizeMediaUrl(String(item || ""));
          if (abs) fromJson.push(abs);
        }
      }
    } catch {
      /* ignore */
    }
  }
  const cover = absolutizeMediaUrl(String(car.imageUrl || "").trim() || carImageSrc(car.imageUrl));
  const list = fromJson.length ? fromJson : cover ? [cover] : [];
  // Unsplash placeholder z carImageSrc nie chcemy jako „prawdziwe” zdjęcie w OG.
  return Array.from(new Set(list.filter((u) => !u.includes("images.unsplash.com"))));
}

export type CarShareMeta = {
  id: number;
  title: string;
  ogTitle: string;
  ogDescription: string;
  canonicalUrl: string;
  /** JPEG z /api/og/car — Facebook niezawodnie pokazuje kartę. */
  imageUrl: string;
  /** Oryginalne zdjęcie auta (webp/jpeg) do kompozycji karty. */
  photoUrl: string;
  priceLabel: string;
  locationLabel: string;
  summaryLine: string;
  chips: string[];
};

export async function loadCarShareMeta(carId: number): Promise<CarShareMeta | null> {
  if (!Number.isFinite(carId) || carId <= 0) return null;
  const car = await findCarById(carId);
  if (!car) return null;

  const title = String(car.title || "").trim() || `${car.make} ${car.model} ${car.year}`;
  const priceLabel = formatCarPrice(car.pricePln);
  const locationLabel = String(car.city || "").trim() || "Polska";
  const mileage = formatMileage(car.mileageKm);
  const makeModel = `${car.make} ${car.model}`.trim();
  const year = car.year != null ? String(car.year) : "";
  const chips = [makeModel, year, mileage].filter(Boolean);
  const summaryLine = [...chips, locationLabel].filter(Boolean).join(" · ");
  const images = parseCarImages(car);
  const photoUrl = images[0] || "";
  const origin = resolvePublicAppOrigin();
  const canonicalUrl = `${origin}/cars/${carId}`;
  const imageUrl = `${origin}/api/og/car/${carId}?v6`;

  return {
    id: carId,
    title,
    ogTitle: `${title} — ${priceLabel}`,
    ogDescription: `${summaryLine}. Ogłoszenie EstateOS™Car — zdjęcia, parametry i kontakt.`,
    canonicalUrl,
    imageUrl,
    photoUrl,
    priceLabel,
    locationLabel,
    summaryLine,
    chips,
  };
}

export function carShareMetadata(meta: CarShareMeta): Metadata {
  return {
    title: {
      absolute: `${meta.ogTitle} | EstateOS™Car`,
    },
    description: meta.ogDescription,
    metadataBase: new URL(resolvePublicAppOrigin()),
    alternates: { canonical: meta.canonicalUrl },
    openGraph: {
      type: "website",
      siteName: "EstateOS™Car",
      title: meta.ogTitle,
      description: meta.ogDescription,
      url: meta.canonicalUrl,
      locale: "pl_PL",
      images: [
        {
          url: meta.imageUrl,
          width: 1200,
          height: 630,
          type: "image/jpeg",
          alt: meta.ogTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: meta.ogTitle,
      description: meta.ogDescription,
      images: [meta.imageUrl],
    },
    robots: { index: true, follow: true },
  };
}

import type { Metadata } from "next";
import CarsCatalogClient from "@/components/cars/CarsCatalogClient";
import { ESTATEOS_PUBLIC_URLS } from "@/lib/estateOsPublicFacts";

export const metadata: Metadata = {
  title: "Katalog samochodów",
  description:
    "Przeglądaj ogłoszenia samochodowe w EstateOS™Car. Jedno konto Home/Car i kontakt ze sprzedającymi.",
  openGraph: {
    title: "EstateOS™Car — katalog samochodów",
    description:
      "Samochody na sprzedaż w ekosystemie EstateOS. Katalog, mapa i Contact — Home i Car w jednym koncie.",
    url: ESTATEOS_PUBLIC_URLS.carsCatalog,
    siteName: "EstateOS™Car",
    locale: "pl_PL",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "EstateOS™Car — katalog samochodów",
    description: "Samochody na sprzedaż w ekosystemie EstateOS. Home i Car w jednym koncie.",
  },
  alternates: { canonical: ESTATEOS_PUBLIC_URLS.carsCatalog },
};

export default function CarsCatalogPage() {
  return <CarsCatalogClient />;
}

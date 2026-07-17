import type { Metadata } from "next";
import CarsCatalogClient from "@/components/cars/CarsCatalogClient";
import { carsOpenGraph, carsTwitter } from "@/lib/carsOgMetadata";
import { ESTATEOS_PUBLIC_URLS } from "@/lib/estateOsPublicFacts";

export const metadata: Metadata = {
  title: "Katalog samochodów",
  description:
    "Przeglądaj ogłoszenia samochodowe w EstateOS™Car. Wystaw auto za darmo — jedno konto Home/Car.",
  openGraph: carsOpenGraph({
    title: "EstateOS™Car — katalog samochodów",
    description:
      "Zastrzeż VIN — kupujący sprawdzi historię i OC. Samochody na sprzedaż, wystawienie za darmo.",
    url: ESTATEOS_PUBLIC_URLS.carsCatalog,
    siteName: "EstateOS™Car",
    locale: "pl_PL",
    type: "website",
  }),
  twitter: carsTwitter({
    title: "EstateOS™Car — katalog samochodów",
    description:
      "Zastrzeż VIN — kupujący sprawdzi historię i OC. Samochody na sprzedaż, wystawienie za darmo.",
  }),
  alternates: { canonical: ESTATEOS_PUBLIC_URLS.carsCatalog },
};

export default function CarsCatalogPage() {
  return <CarsCatalogClient />;
}

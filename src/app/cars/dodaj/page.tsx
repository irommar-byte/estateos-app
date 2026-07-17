import type { Metadata } from "next";
import AddCarPageClient from "./AddCarPageClient";
import { carsOpenGraph, carsTwitter } from "@/lib/carsOgMetadata";
import { ESTATEOS_PUBLIC_URLS } from "@/lib/estateOsPublicFacts";

export const metadata: Metadata = {
  title: "Wystaw auto na sprzedaż za darmo",
  description:
    "Dodaj ogłoszenie samochodu za darmo w EstateOS™Car — skan dowodu, galeria zdjęć, mapa i kontakt z kupującymi. Jedno konto EstateOS: Home i Car.",
  openGraph: carsOpenGraph({
    title: "EstateOS™Car — wystaw auto za darmo",
    description:
      "Wystaw samochód za darmo. Skan dowodu, zdjęcia, mapa — bez prowizji portalowej. Home i Car w jednym koncie.",
    url: ESTATEOS_PUBLIC_URLS.carsAdd,
    siteName: "EstateOS™Car",
    locale: "pl_PL",
    type: "website",
  }),
  twitter: carsTwitter({
    title: "EstateOS™Car — wystaw auto za darmo",
    description:
      "Wystaw samochód za darmo. Skan dowodu, zdjęcia, mapa — Home i Car w jednym koncie.",
  }),
  alternates: { canonical: ESTATEOS_PUBLIC_URLS.carsAdd },
};

export default function AddCarPage() {
  return <AddCarPageClient />;
}

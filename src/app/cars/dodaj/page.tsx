import type { Metadata } from "next";
import AddCarPageClient from "./AddCarPageClient";
import { ESTATEOS_PUBLIC_URLS } from "@/lib/estateOsPublicFacts";

export const metadata: Metadata = {
  title: "Wystaw auto na sprzedaż",
  description:
    "Dodaj ogłoszenie samochodu w EstateOS™Car — skan dowodu, galeria zdjęć, mapa i kontakt z kupującymi. Jedno konto EstateOS: Home i Car.",
  openGraph: {
    title: "EstateOS™Car — wystaw auto na sprzedaż",
    description:
      "Ogłoszenia samochodowe w EstateOS. Skan dowodu, zdjęcia, mapa — bez prowizji portalowej. Home i Car w jednym koncie.",
    url: ESTATEOS_PUBLIC_URLS.carsAdd,
    siteName: "EstateOS™Car",
    locale: "pl_PL",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "EstateOS™Car — wystaw auto na sprzedaż",
    description:
      "Ogłoszenia samochodowe w EstateOS. Skan dowodu, zdjęcia, mapa — Home i Car w jednym koncie.",
  },
  alternates: { canonical: ESTATEOS_PUBLIC_URLS.carsAdd },
};

export default function AddCarPage() {
  return <AddCarPageClient />;
}

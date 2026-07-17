import type { Metadata } from "next";
import AddCarPageClient from "./AddCarPageClient";
import { carsOpenGraph, carsTwitter } from "@/lib/carsOgMetadata";
import { ESTATEOS_PUBLIC_URLS } from "@/lib/estateOsPublicFacts";

const OG_TITLE = "EstateOS™Car — wystaw auto za darmo";
const OG_DESCRIPTION =
  "Zastrzeż VIN i rejestrację — kupujący i tak sprawdzi historię pojazdu i OC, bez ujawniania pełnych danych. Wystawienie za darmo.";

export const metadata: Metadata = {
  title: "Wystaw auto na sprzedaż za darmo",
  description: OG_DESCRIPTION,
  openGraph: carsOpenGraph({
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    url: ESTATEOS_PUBLIC_URLS.carsAdd,
    siteName: "EstateOS™Car",
    locale: "pl_PL",
    type: "website",
  }),
  twitter: carsTwitter({
    title: OG_TITLE,
    description: OG_DESCRIPTION,
  }),
  alternates: { canonical: ESTATEOS_PUBLIC_URLS.carsAdd },
};

export default function AddCarPage() {
  return <AddCarPageClient />;
}

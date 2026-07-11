import type { Metadata } from "next";
import StartPageClient from "./StartPageClient";
import { ESTATEOS_PUBLIC_URLS, ESTATEOS_TAGLINE_PL } from "@/lib/estateOsPublicFacts";

export const metadata: Metadata = {
  title: "Start — EstateOS™",
  description:
    "Poznaj EstateOS™: mapa nieruchomości, aplikacja mobilna i CRM dla agencji. Wybierz ścieżkę i dołącz w kilka minut.",
  openGraph: {
    title: "EstateOS™ — platforma nieruchomości nowej generacji",
    description: ESTATEOS_TAGLINE_PL,
    url: ESTATEOS_PUBLIC_URLS.start,
  },
  alternates: { canonical: ESTATEOS_PUBLIC_URLS.start },
};

export default function StartPage() {
  return <StartPageClient />;
}

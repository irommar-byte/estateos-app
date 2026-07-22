import type { Metadata } from "next";
import AudienceLanding from "@/components/marketing/AudienceLanding";
import { ESTATEOS_PUBLIC_URLS } from "@/lib/estateOsPublicFacts";
import { FREE_LISTING_KEYWORDS } from "@/lib/seo/freeListingContent";

export const metadata: Metadata = {
  title: "Wystaw mieszkanie lub dom za darmo — dla osób prywatnych",
  description:
    "Sprzedaj lub wynajmij nieruchomość za darmo na EstateOS™. Mieszkanie, dom, działka — bez opłat za podstawową publikację. Mapa, Radar i bezpieczny kontakt.",
  keywords: [...FREE_LISTING_KEYWORDS],
  openGraph: {
    title: "Wystaw nieruchomość za darmo | EstateOS™",
    description: "Dla właścicieli: sprzedaj mieszkanie lub dom za darmo — portal EstateOS™Home.",
    url: ESTATEOS_PUBLIC_URLS.private,
    locale: "pl_PL",
    type: "website",
  },
  alternates: { canonical: ESTATEOS_PUBLIC_URLS.private },
};

export default function PrivateAudiencePage() {
  return <AudienceLanding audience="private" />;
}

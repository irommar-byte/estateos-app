import Pricing from "@/components/Pricing";
import type { Metadata } from "next";
import { ESTATEOS_PUBLIC_URLS } from "@/lib/estateOsPublicFacts";

export const metadata: Metadata = {
  title: "Cennik — wystaw ogłoszenie za darmo",
  description:
    "Sprawdź, co jest za darmo na EstateOS™: podstawowa publikacja mieszkania, domu lub samochodu oraz pakiety dla agencji.",
  openGraph: {
    title: "Cennik EstateOS™ — publikacja za darmo",
    description: "Wystaw ogłoszenie za 0 zł. Porównaj plany Home i Car.",
    url: ESTATEOS_PUBLIC_URLS.pricing,
    locale: "pl_PL",
  },
  alternates: { canonical: ESTATEOS_PUBLIC_URLS.pricing },
};

export default function PricingPage() {
  return (
    <main className="theme-aware-dashboard eos-page-shell bg-[var(--eos-bg)]">
      <Pricing />
    </main>
  );
}

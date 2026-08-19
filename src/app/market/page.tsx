import type { Metadata } from "next";
import MarketHubClient from "@/components/market/MarketHubClient";

export const metadata: Metadata = {
  title: "EstateOS™ Market — ceny transakcyjne",
  description:
    "Analiza wartości nieruchomości na podstawie Rejestru Cen Nieruchomości: mediana, comps i rekomendowana cena ofertowa.",
};

export default function MarketPage() {
  return (
    <main className="theme-aware-dashboard eos-page-shell bg-[var(--eos-bg)]">
      <MarketHubClient />
    </main>
  );
}

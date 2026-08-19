import type { Metadata } from "next";
import WycenaClient from "@/components/market/WycenaClient";

export const metadata: Metadata = {
  title: "Wycena nieruchomości — EstateOS™ Market",
  description: "Sprawdź wartość mieszkania na podstawie transakcji z Rejestru Cen Nieruchomości. Raport na e-mail za 1 kredyt.",
};

export default function WycenaPage() {
  return (
    <main className="theme-aware-dashboard eos-page-shell bg-[var(--eos-bg)]">
      <WycenaClient />
    </main>
  );
}

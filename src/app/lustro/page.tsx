import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Mój kierunek | EstateOS™",
  description: "Twój kierunek Discovery — postęp, tropy i następny spokojny krok.",
  robots: { index: false, follow: false },
};

/** Lustro folded into one Kierunek surface. */
export default function LustroPage() {
  redirect("/moj-kierunek");
}

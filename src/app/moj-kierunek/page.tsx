import type { Metadata } from "next";
import MojKierunekClient from "./MojKierunekClient";

export const metadata: Metadata = {
  title: "Mój kierunek | EstateOS™",
  description: "Żywy podgląd Twoich preferencji Discovery — jak EstateOS uczy się z każdej decyzji.",
  robots: { index: false, follow: false },
};

export default function MojKierunekPage() {
  return <MojKierunekClient />;
}

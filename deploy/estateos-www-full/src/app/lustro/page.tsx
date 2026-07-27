import type { Metadata } from "next";
import LustroClient from "./LustroClient";

export const metadata: Metadata = {
  title: "Lustro preferencji | EstateOS™",
  description: "Głęboka analiza Twojego gustu Discovery — miasta, powody, tropy i historia decyzji.",
  robots: { index: false, follow: false },
};

export default function LustroPage() {
  return <LustroClient />;
}

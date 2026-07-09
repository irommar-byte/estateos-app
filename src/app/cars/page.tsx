import type { Metadata } from "next";
import CarsCatalogClient from "@/components/cars/CarsCatalogClient";

export const metadata: Metadata = {
  title: "Katalog samochodów | EstateOS™Car",
  description:
    "Przeglądaj ogłoszenia samochodowe w ekosystemie EstateOS. Jedno konto, przełączanie Home/Car i profesjonalny kontakt ze sprzedającymi.",
};

export default function CarsCatalogPage() {
  return <CarsCatalogClient />;
}

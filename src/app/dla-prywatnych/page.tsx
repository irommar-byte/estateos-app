import AudienceLanding from "@/components/marketing/AudienceLanding";

export const metadata = {
  title: "Dla osób prywatnych",
  description:
    "Sprzedaj, wynajmij lub znajdź nieruchomość bez opłat za publikację — mapa, Radar i Deal Room w EstateOS™.",
};

export default function PrivateAudiencePage() {
  return <AudienceLanding audience="private" />;
}

import AudienceLanding from "@/components/marketing/AudienceLanding";

export const metadata = {
  title: "Dla agencji i pośredników",
  description:
    "Profesjonalne narzędzia dla biur nieruchomości — CRM, weryfikacja ofert, Radar klientów i Deal Room w EstateOS™.",
};

export default function AgencyAudiencePage() {
  return <AudienceLanding audience="agency" />;
}

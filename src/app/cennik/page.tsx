import Pricing from "@/components/Pricing";

export const metadata = {
  title: 'Cennik | EstateOS',
  description: 'Wybierz plan dopasowany do Twoich potrzeb inwestycyjnych i sprzedażowych.',
};

export default function CennikPage() {
  return (
    <main id="main-content" className="min-h-screen bg-black pt-8 md:pt-10">
      <Pricing />
    </main>
  );
}

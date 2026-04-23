import Pricing from "@/components/Pricing";

export const metadata = {
  title: 'Cennik | EstateOS',
  description: 'Wybierz plan dopasowany do Twoich potrzeb inwestycyjnych i sprzedażowych.',
};

export default function CennikPage() {
  return (
    <main className="bg-black min-h-screen pt-20">
      <Pricing />
    </main>
  );
}

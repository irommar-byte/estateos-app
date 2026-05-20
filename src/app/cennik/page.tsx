import Pricing from "@/components/Pricing";

export const metadata = {
  title: 'Pricing | EstateOS',
  description: 'Choose a plan tailored to your investment and sales needs.',
};

export default function PricingPage() {
  return (
    <main className="bg-black min-h-screen pt-20">
      <Pricing />
    </main>
  );
}

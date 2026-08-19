"use client";

import MarketValuationPanel from "@/components/market/MarketValuationPanel";

type Props = {
  lat?: number | null;
  lng?: number | null;
  area?: number | null;
  rooms?: number | null;
  floor?: number | null;
  city?: string | null;
  district?: string | null;
  address?: string | null;
  price?: number | null;
};

export default function OfferMarketAnalysis(props: Props) {
  if (!props.lat || !props.lng || !props.area) return null;
  return (
    <div className="mt-8">
      <MarketValuationPanel
        {...props}
        listingPrice={props.price}
        purpose="consumer"
        showReport
      />
    </div>
  );
}

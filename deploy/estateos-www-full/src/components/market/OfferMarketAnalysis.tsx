"use client";

import MarketValuationPanel from "@/components/market/MarketValuationPanel";
import MarketProTeaser from "@/components/market/MarketProTeaser";

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
  hasMarketPro?: boolean;
  teaserHref?: string;
  teaserCta?: string;
};

export default function OfferMarketAnalysis(props: Props) {
  if (!props.lat || !props.lng || !props.area) return null;
  if (!props.hasMarketPro) {
    return <MarketProTeaser href={props.teaserHref} ctaLabel={props.teaserCta} />;
  }
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

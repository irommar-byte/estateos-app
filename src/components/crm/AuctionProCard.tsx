"use client";

import { useState } from "react";
import { useLocale } from "@/contexts/LocaleContext";
import { getDictionary } from "@/i18n/dictionaries";
import ProAuctionManageModal from "@/components/crm/ProAuctionManageModal";
import ProToolBadge from "@/components/crm/ProToolBadge";

type OfferRow = { id: number; title: string; city?: string; district?: string; price?: number };

type Props = {
  activeOffers: OfferRow[];
  onChanged?: () => void;
};

export default function AuctionProCard({ activeOffers, onChanged }: Props) {
  const { locale } = useLocale();
  const copy = getDictionary(locale).crm.proTools;
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <>
      <ProToolBadge
        icon="gavel"
        badgeLabel={copy.exclusiveBadge}
        title={copy.auctionTitle}
        subtitle={copy.auctionSubtitle}
        onClick={() => setPanelOpen(true)}
      />

      <ProAuctionManageModal
        isOpen={panelOpen}
        copy={copy}
        activeOffers={activeOffers}
        onClose={() => setPanelOpen(false)}
        onChanged={() => onChanged?.()}
      />
    </>
  );
}

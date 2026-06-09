"use client";

import { useLocale } from "@/contexts/LocaleContext";
import { getDictionary } from "@/i18n/dictionaries";
import ProToolBadge from "@/components/crm/ProToolBadge";

export default function AuctionProCard() {
  const { locale } = useLocale();
  const copy = getDictionary(locale).crm.proTools;

  return (
    <ProToolBadge
      icon="gavel"
      badgeLabel={copy.exclusiveBadge}
      title={copy.auctionTitle}
      subtitle={copy.auctionSubtitle}
      comingSoon
      soonLabel={copy.auctionSoon}
    />
  );
}

"use client";

import { useState } from "react";
import { useLocale } from "@/contexts/LocaleContext";
import { getDictionary } from "@/i18n/dictionaries";
import ProOpenHouseManageModal from "@/components/crm/ProOpenHouseManageModal";
import ProToolBadge from "@/components/crm/ProToolBadge";

type OfferRow = { id: number; title: string; city?: string; district?: string };

type Props = {
  activeOffers: OfferRow[];
  onChanged?: () => void;
};

export default function OpenHouseProCard({ activeOffers, onChanged }: Props) {
  const { locale } = useLocale();
  const copy = getDictionary(locale).crm.proTools;
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <>
      <ProToolBadge
        icon="door"
        badgeLabel={copy.openHouseTag}
        title={copy.openHouseTitle}
        subtitle={copy.openHouseSubtitle}
        onClick={() => setPanelOpen(true)}
      />

      <ProOpenHouseManageModal
        isOpen={panelOpen}
        copy={copy}
        activeOffers={activeOffers}
        onClose={() => setPanelOpen(false)}
        onChanged={() => {
          onChanged?.();
        }}
      />
    </>
  );
}

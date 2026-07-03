"use client";

import { Suspense } from "react";
import CampaignAttribution from "@/components/marketing/CampaignAttribution";

export default function CampaignAttributionBoundary() {
  return (
    <Suspense fallback={null}>
      <CampaignAttribution />
    </Suspense>
  );
}
